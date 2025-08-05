-- ====================================================================
-- Migration: Prevent Duplicate Active Repairs
-- Version: 002  
-- Date: 2025-01-04
-- Description: Добавляем ограничения для предотвращения дублирования активных ремонтов
-- ====================================================================

-- ====================================================================
-- 1. СОЗДАНИЕ ЧАСТИЧНОГО УНИКАЛЬНОГО ИНДЕКСА (вне транзакции)
-- ====================================================================

-- Создаем частичный уникальный индекс, который предотвращает создание
-- нескольких активных ремонтов для одного велосипеда
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_repair_per_bike 
    ON maintenance_events (bike_id) 
    WHERE "статус_ремонта" IN ('запланирован', 'в ремонте', 'ожидает деталей');

BEGIN;

-- ====================================================================
-- 2. ДОБАВЛЕНИЕ КОММЕНТАРИЕВ
-- ====================================================================

COMMENT ON INDEX idx_unique_active_repair_per_bike IS 
    'Предотвращает создание нескольких активных ремонтов для одного велосипеда';

-- ====================================================================
-- 3. СОЗДАНИЕ ФУНКЦИИ ДЛЯ ПРОВЕРКИ АКТИВНЫХ РЕМОНТОВ
-- ====================================================================

CREATE OR REPLACE FUNCTION check_active_repairs_before_insert()
RETURNS TRIGGER AS $$
DECLARE
    active_count INTEGER;
    active_repair_info RECORD;
BEGIN
    -- Проверяем только если создается активный ремонт
    IF NEW."статус_ремонта" IN ('запланирован', 'в ремонте', 'ожидает деталей') THEN
        
        -- Считаем количество активных ремонтов для этого велосипеда
        SELECT COUNT(*) INTO active_count
        FROM maintenance_events 
        WHERE bike_id = NEW.bike_id 
        AND "статус_ремонта" IN ('запланирован', 'в ремонте', 'ожидает деталей')
        AND id != COALESCE(NEW.id, 0); -- Исключаем текущую запись при UPDATE
        
        -- Если есть активные ремонты, получаем информацию о первом
        IF active_count > 0 THEN
            SELECT 
                id, 
                "тип_ремонта", 
                "статус_ремонта",
                repair_type,
                "ремонт_запланирован_на"
            INTO active_repair_info
            FROM maintenance_events 
            WHERE bike_id = NEW.bike_id 
            AND "статус_ремонта" IN ('запланирован', 'в ремонте', 'ожидает деталей')
            AND id != COALESCE(NEW.id, 0)
            LIMIT 1;
            
            -- Формируем подробное сообщение об ошибке
            RAISE EXCEPTION 
                'АКТИВНЫЙ_РЕМОНТ_СУЩЕСТВУЕТ: Велосипед ID % уже находится в активном ремонте (ID: %, тип: %, статус: "%", планируемая дата: %). Завершите текущий ремонт перед началом нового.',
                NEW.bike_id,
                active_repair_info.id,
                COALESCE(active_repair_info.repair_type, 'не указан'),
                active_repair_info."статус_ремонта",
                COALESCE(active_repair_info."ремонт_запланирован_на"::TEXT, 'не указана')
                USING ERRCODE = '23505'; -- Код ошибки уникальности
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- 4. СОЗДАНИЕ ТРИГГЕРА
-- ====================================================================

-- Удаляем триггер если он существует
DROP TRIGGER IF EXISTS trigger_check_active_repairs ON maintenance_events;

-- Создаем триггер для INSERT и UPDATE
CREATE TRIGGER trigger_check_active_repairs
    BEFORE INSERT OR UPDATE ON maintenance_events
    FOR EACH ROW
    EXECUTE FUNCTION check_active_repairs_before_insert();

-- ====================================================================
-- 5. СОЗДАНИЕ ФУНКЦИИ ДЛЯ ПОЛУЧЕНИЯ АКТИВНЫХ РЕМОНТОВ ВЕЛОСИПЕДА
-- ====================================================================

CREATE OR REPLACE FUNCTION get_active_repairs_for_bike(p_bike_id INTEGER)
RETURNS TABLE (
    repair_id INTEGER,
    repair_type_code VARCHAR(20),
    repair_type_name TEXT,
    status_name TEXT,
    planned_date DATE,
    created_at TIMESTAMP,
    priority INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        me.id as repair_id,
        me.repair_type as repair_type_code,
        CASE me.repair_type
            WHEN 'current' THEN 'Текущий/Экстренный'
            WHEN 'weekly' THEN 'Еженедельное ТО'  
            WHEN 'longterm' THEN 'Долгосрочный'
            ELSE 'Неизвестный'
        END as repair_type_name,
        me."статус_ремонта" as status_name,
        me."ремонт_запланирован_на"::DATE as planned_date,
        me.created_at,
        me.priority
    FROM maintenance_events me
    WHERE me.bike_id = p_bike_id
    AND me."статус_ремонта" IN ('запланирован', 'в ремонте', 'ожидает деталей')
    ORDER BY me.priority ASC, me.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- 6. ДОБАВЛЕНИЕ КОММЕНТАРИЕВ К ФУНКЦИЯМ
-- ====================================================================

COMMENT ON FUNCTION check_active_repairs_before_insert() IS 
    'Триггерная функция для предотвращения создания дублирующих активных ремонтов';

COMMENT ON FUNCTION get_active_repairs_for_bike(INTEGER) IS 
    'Возвращает список всех активных ремонтов для указанного велосипеда';

-- ====================================================================
-- 7. ОЧИСТКА СУЩЕСТВУЮЩИХ ДУБЛИКАТОВ (ЕСЛИ ЕСТЬ)
-- ====================================================================

-- Получаем информацию о дубликатах перед их очисткой
DO $$
DECLARE
    duplicate_count INTEGER;
    cleanup_report TEXT := '';
BEGIN
    -- Подсчитываем дубликаты
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT bike_id, COUNT(*) as cnt
        FROM maintenance_events 
        WHERE "статус_ремонта" IN ('запланирован', 'в ремонте', 'ожидает деталей')
        GROUP BY bike_id 
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
        RAISE NOTICE 'ВНИМАНИЕ: Найдено % велосипедов с дублирующими активными ремонтами', duplicate_count;
        RAISE NOTICE 'Рекомендуется вручную проверить и решить конфликты перед применением ограничений';
        
        -- Выводим детальную информацию о дубликатах
        FOR cleanup_report IN 
            SELECT 'Велосипед ID ' || bike_id || ' имеет ' || COUNT(*) || ' активных ремонтов: ' ||
                   string_agg('ID ' || id || ' (' || "статус_ремонта" || ')', ', ')
            FROM maintenance_events 
            WHERE "статус_ремонта" IN ('запланирован', 'в ремонте', 'ожидает деталей')
            GROUP BY bike_id 
            HAVING COUNT(*) > 1
        LOOP
            RAISE NOTICE '%', cleanup_report;
        END LOOP;
    ELSE
        RAISE NOTICE 'Дублирующих активных ремонтов не найдено';
    END IF;
END $$;

COMMIT;

-- ====================================================================
-- ФИНАЛИЗАЦИЯ
-- ====================================================================

-- Обновляем статистику
ANALYZE maintenance_events;

-- Выводим итоговую информацию
SELECT 
    'Миграция 002_prevent_duplicate_active_repairs завершена' as status,
    NOW() as completed_at,
    (SELECT COUNT(*) FROM maintenance_events WHERE "статус_ремонта" IN ('запланирован', 'в ремонте', 'ожидает деталей')) as active_repairs_count;