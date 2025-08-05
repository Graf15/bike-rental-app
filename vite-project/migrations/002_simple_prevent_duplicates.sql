-- ====================================================================
-- Migration: Simple Prevent Duplicate Active Repairs
-- Version: 002-simple
-- Date: 2025-01-04
-- Description: Упрощенная версия для предотвращения дублирования активных ремонтов
-- ====================================================================

-- Шаг 1: Создаем уникальный индекс (вне транзакции)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_repair_per_bike 
    ON maintenance_events (bike_id) 
    WHERE "статус_ремонта" IN ('запланирован', 'в ремонте', 'ожидает деталей');

-- Шаг 2: Добавляем комментарий к индексу
COMMENT ON INDEX idx_unique_active_repair_per_bike IS 
    'Предотвращает создание нескольких активных ремонтов для одного велосипеда';

-- Шаг 3: Создаем функцию для проверки активных ремонтов
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
        AND id != COALESCE(NEW.id, 0);
        
        -- Если есть активные ремонты, получаем информацию о первом
        IF active_count > 0 THEN
            SELECT 
                id, 
                "тип_ремонта", 
                "статус_ремонта",
                repair_type
            INTO active_repair_info
            FROM maintenance_events 
            WHERE bike_id = NEW.bike_id 
            AND "статус_ремонта" IN ('запланирован', 'в ремонте', 'ожидает деталей')
            AND id != COALESCE(NEW.id, 0)
            LIMIT 1;
            
            -- Формируем сообщение об ошибке
            RAISE EXCEPTION 
                'Велосипед ID % уже находится в активном ремонте (ID: %, тип: %, статус: "%"). Завершите текущий ремонт перед началом нового.',
                NEW.bike_id,
                active_repair_info.id,
                COALESCE(active_repair_info.repair_type, 'не указан'),
                active_repair_info."статус_ремонта"
                USING ERRCODE = '23505';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Шаг 4: Создаем триггер
DROP TRIGGER IF EXISTS trigger_check_active_repairs ON maintenance_events;
CREATE TRIGGER trigger_check_active_repairs
    BEFORE INSERT OR UPDATE ON maintenance_events
    FOR EACH ROW
    EXECUTE FUNCTION check_active_repairs_before_insert();

-- Шаг 5: Создаем вспомогательную функцию для получения активных ремонтов
CREATE OR REPLACE FUNCTION get_active_repairs_for_bike(p_bike_id INTEGER)
RETURNS TABLE (
    repair_id INTEGER,
    repair_type_code VARCHAR(20),
    repair_type_name TEXT,
    status_name TEXT,
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
        me.created_at,
        me.priority
    FROM maintenance_events me
    WHERE me.bike_id = p_bike_id
    AND me."статус_ремонта" IN ('запланирован', 'в ремонте', 'ожидает деталей')
    ORDER BY me.priority ASC, me.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Шаг 6: Добавляем комментарии к функциям
COMMENT ON FUNCTION check_active_repairs_before_insert() IS 
    'Триггерная функция для предотвращения создания дублирующих активных ремонтов';

COMMENT ON FUNCTION get_active_repairs_for_bike(INTEGER) IS 
    'Возвращает список всех активных ремонтов для указанного велосипеда';

-- Обновляем статистику
ANALYZE maintenance_events;

-- Выводим итоговую информацию
SELECT 
    'Миграция 002_simple_prevent_duplicates завершена' as status,
    NOW() as completed_at,
    (SELECT COUNT(*) FROM maintenance_events WHERE "статус_ремонта" IN ('запланирован', 'в ремонте', 'ожидает деталей')) as active_repairs_count;