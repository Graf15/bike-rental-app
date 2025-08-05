-- ====================================================================  
-- Migration: Refined Repair Constraints
-- Version: 003
-- Date: 2025-01-04  
-- Description: Обновление логики ограничений для поддержки refined business rules
-- ====================================================================

-- ====================================================================
-- 1. УДАЛЕНИЕ СТАРОГО ОГРАНИЧИТЕЛЬНОГО ИНДЕКСА  
-- ====================================================================

-- Удаляем существующий слишком ограничительный индекс
DROP INDEX IF EXISTS idx_unique_active_repair_per_bike;

-- ====================================================================
-- 2. СОЗДАНИЕ НОВОГО ЧАСТИЧНОГО ИНДЕКСА
-- ====================================================================

-- Новый индекс предотвращает конфликты только для реально блокирующих ремонтов
-- Разрешает: 
-- - множественные longterm ремонты (планирование)
-- - множественные weekly ремонты со статусом 'запланирован'
-- Запрещает:
-- - дублирование ремонтов, которые реально блокируют велосипед
CREATE UNIQUE INDEX idx_unique_blocking_repair_per_bike 
    ON maintenance_events (bike_id) 
    WHERE "статус_ремонта" IN ('в ремонте', 'ожидает деталей') 
    AND repair_type != 'longterm';

-- ====================================================================
-- 3. ОБНОВЛЕНИЕ ТРИГГЕРНОЙ ФУНКЦИИ
-- ====================================================================

CREATE OR REPLACE FUNCTION check_active_repairs_before_insert()
RETURNS TRIGGER AS $$
DECLARE
    blocking_count INTEGER;
    blocking_repair_info RECORD;
BEGIN
    -- Проверяем только если создается потенциально конфликтующий ремонт
    -- Разрешаем без проверки:
    -- 1. Все longterm ремонты (только планирование, не блокируют велосипед)
    -- 2. Weekly ремонты со статусом 'запланирован' (планирование будущего ТО)
    IF NEW.repair_type = 'longterm' THEN
        -- Longterm ремонты всегда разрешены (планирование)
        RETURN NEW;
    END IF;
    
    IF NEW.repair_type = 'weekly' AND NEW."статус_ремонта" = 'запланирован' THEN
        -- Планирование еженедельного ТО всегда разрешено
        RETURN NEW;
    END IF;
    
    -- Проверяем конфликты только для ремонтов, которые реально блокируют велосипед
    IF NEW."статус_ремонта" IN ('в ремонте', 'ожидает деталей') THEN
        
        -- Считаем блокирующие ремонты для этого велосипеда
        -- Блокирующими считаются ремонты с статусом 'в ремонте' или 'ожидает деталей'
        -- которые НЕ являются longterm (longterm не блокируют велосипед)
        SELECT COUNT(*) INTO blocking_count
        FROM maintenance_events 
        WHERE bike_id = NEW.bike_id 
        AND "статус_ремонта" IN ('в ремонте', 'ожидает деталей')
        AND repair_type != 'longterm'
        AND id != COALESCE(NEW.id, 0); -- Исключаем текущую запись при UPDATE
        
        -- Если есть блокирующие ремонты, получаем информацию о первом
        IF blocking_count > 0 THEN
            SELECT 
                id, 
                "тип_ремонта", 
                "статус_ремонта",
                repair_type,
                "ремонт_запланирован_на"
            INTO blocking_repair_info
            FROM maintenance_events 
            WHERE bike_id = NEW.bike_id 
            AND "статус_ремонта" IN ('в ремонте', 'ожидает деталей')
            AND repair_type != 'longterm'
            AND id != COALESCE(NEW.id, 0)
            LIMIT 1;
            
            -- Формируем подробное сообщение об ошибке
            RAISE EXCEPTION 
                'БЛОКИРУЮЩИЙ_РЕМОНТ_АКТИВЕН: Велосипед ID % заблокирован активным ремонтом (ID: %, тип: %, статус: "%", дата: %). Завершите блокирующий ремонт перед началом нового.',
                NEW.bike_id,
                blocking_repair_info.id,
                COALESCE(blocking_repair_info.repair_type, 'не указан'),
                blocking_repair_info."статус_ремонта",
                COALESCE(blocking_repair_info."ремонт_запланирован_на"::TEXT, 'не указана')
                USING ERRCODE = '23505'; -- Код ошибки уникальности
        END IF;
    END IF;
    
    -- Дополнительная проверка для запланированных ремонтов (кроме weekly и longterm)
    -- Для current ремонтов со статусом 'запланирован' тоже проверяем блокирующие
    IF NEW.repair_type = 'current' AND NEW."статус_ремонта" = 'запланирован' THEN
        
        SELECT COUNT(*) INTO blocking_count
        FROM maintenance_events 
        WHERE bike_id = NEW.bike_id 
        AND "статус_ремонта" IN ('в ремонте', 'ожидает деталей')
        AND repair_type != 'longterm'
        AND id != COALESCE(NEW.id, 0);
        
        IF blocking_count > 0 THEN
            SELECT 
                id, 
                "тип_ремонта", 
                "статус_ремонта",
                repair_type
            INTO blocking_repair_info
            FROM maintenance_events 
            WHERE bike_id = NEW.bike_id 
            AND "статус_ремонта" IN ('в ремонте', 'ожидает деталей')
            AND repair_type != 'longterm'
            AND id != COALESCE(NEW.id, 0)
            LIMIT 1;
            
            RAISE EXCEPTION 
                'БЛОКИРУЮЩИЙ_РЕМОНТ_АКТИВЕН: Нельзя запланировать ремонт для велосипеда ID % - активен блокирующий ремонт (ID: %, тип: %, статус: "%").',
                NEW.bike_id,
                blocking_repair_info.id,
                COALESCE(blocking_repair_info.repair_type, 'не указан'),
                blocking_repair_info."статус_ремонта"
                USING ERRCODE = '23505';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- 4. ОБНОВЛЕНИЕ ФУНКЦИИ ПОЛУЧЕНИЯ АКТИВНЫХ РЕМОНТОВ
-- ====================================================================

CREATE OR REPLACE FUNCTION get_active_repairs_for_bike(p_bike_id INTEGER)
RETURNS TABLE (
    repair_id INTEGER,
    repair_type_code VARCHAR(20),
    repair_type_name TEXT,
    status_name TEXT,
    planned_date DATE,
    created_at TIMESTAMP,
    priority INTEGER,
    is_blocking BOOLEAN
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
        me.priority,
        -- Определяем, блокирует ли ремонт велосипед
        CASE 
            WHEN me.repair_type = 'longterm' THEN false
            WHEN me.repair_type = 'weekly' AND me."статус_ремонта" = 'запланирован' THEN false
            WHEN me."статус_ремонта" IN ('в ремонте', 'ожидает деталей') THEN true
            ELSE false
        END as is_blocking
    FROM maintenance_events me
    WHERE me.bike_id = p_bike_id
    AND me."статус_ремонта" IN ('запланирован', 'в ремонте', 'ожидает деталей')
    ORDER BY 
        -- Сначала блокирующие ремонты
        CASE 
            WHEN me.repair_type = 'longterm' THEN 3
            WHEN me.repair_type = 'weekly' AND me."статус_ремонта" = 'запланирован' THEN 2
            ELSE 1
        END,
        me.priority ASC, 
        me.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- 5. СОЗДАНИЕ ФУНКЦИИ ДЛЯ ПРОВЕРКИ ВОЗМОЖНОСТИ СОЗДАНИЯ РЕМОНТА
-- ====================================================================

CREATE OR REPLACE FUNCTION can_create_repair(
    p_bike_id INTEGER,
    p_repair_type VARCHAR(20),
    p_status VARCHAR(50)
) RETURNS TABLE (
    can_create BOOLEAN,
    reason TEXT,
    blocking_repairs_count INTEGER
) AS $$
DECLARE
    blocking_count INTEGER;
BEGIN
    -- Longterm ремонты всегда можно создавать
    IF p_repair_type = 'longterm' THEN
        RETURN QUERY SELECT true, 'Longterm ремонты разрешены для планирования'::TEXT, 0;
        RETURN;
    END IF;
    
    -- Weekly ремонты со статусом 'запланирован' всегда можно создавать
    IF p_repair_type = 'weekly' AND p_status = 'запланирован' THEN
        RETURN QUERY SELECT true, 'Планирование еженедельного ТО разрешено'::TEXT, 0;
        RETURN;
    END IF;
    
    -- Для остальных случаев проверяем блокирующие ремонты
    SELECT COUNT(*) INTO blocking_count
    FROM maintenance_events 
    WHERE bike_id = p_bike_id 
    AND "статус_ремонта" IN ('в ремонте', 'ожидает деталей')
    AND repair_type != 'longterm';
    
    IF blocking_count > 0 THEN
        RETURN QUERY SELECT 
            false, 
            'Велосипед заблокирован активным ремонтом'::TEXT,
            blocking_count;
    ELSE
        RETURN QUERY SELECT 
            true, 
            'Можно создать ремонт'::TEXT,
            0;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- 6. ДОБАВЛЕНИЕ КОММЕНТАРИЕВ
-- ====================================================================

COMMENT ON INDEX idx_unique_blocking_repair_per_bike IS 
    'Предотвращает конфликты только для реально блокирующих ремонтов (исключая longterm и запланированные weekly)';

COMMENT ON FUNCTION check_active_repairs_before_insert() IS 
    'Триггерная функция с refined business rules: разрешает longterm и запланированные weekly ремонты';

COMMENT ON FUNCTION get_active_repairs_for_bike(INTEGER) IS 
    'Возвращает список активных ремонтов с указанием блокирующих велосипед';

COMMENT ON FUNCTION can_create_repair(INTEGER, VARCHAR, VARCHAR) IS 
    'Проверяет возможность создания ремонта согласно refined business rules';

-- ====================================================================
-- 7. ОБНОВЛЕНИЕ СТАТИСТИКИ
-- ====================================================================

ANALYZE maintenance_events;

-- ====================================================================
-- 8. ТЕСТИРОВАНИЕ НОВОЙ ЛОГИКИ
-- ====================================================================

-- Выводим информацию о применении миграции
DO $$
DECLARE
    longterm_count INTEGER;
    weekly_planned_count INTEGER;
    blocking_count INTEGER;
BEGIN
    -- Подсчитываем различные типы ремонтов
    SELECT COUNT(*) INTO longterm_count
    FROM maintenance_events 
    WHERE repair_type = 'longterm' 
    AND "статус_ремонта" IN ('запланирован', 'в ремонте', 'ожидает деталей');
    
    SELECT COUNT(*) INTO weekly_planned_count
    FROM maintenance_events 
    WHERE repair_type = 'weekly' 
    AND "статус_ремонта" = 'запланирован';
    
    SELECT COUNT(*) INTO blocking_count
    FROM maintenance_events 
    WHERE "статус_ремонта" IN ('в ремонте', 'ожидает деталей')
    AND repair_type != 'longterm';
    
    RAISE NOTICE 'Миграция 003 применена:';
    RAISE NOTICE '- Longterm ремонтов (всегда разрешены): %', longterm_count;
    RAISE NOTICE '- Запланированных weekly ремонтов (разрешены): %', weekly_planned_count;
    RAISE NOTICE '- Блокирующих ремонтов: %', blocking_count;
END $$;

-- Выводим итоговую информацию
SELECT 
    'Миграция 003_refined_repair_constraints завершена' as status,
    NOW() as completed_at,
    (SELECT COUNT(*) FROM maintenance_events WHERE "статус_ремонта" IN ('запланирован', 'в ремонте', 'ожидает деталей')) as total_active_repairs,
    (SELECT COUNT(*) FROM maintenance_events WHERE repair_type = 'longterm') as longterm_repairs,
    (SELECT COUNT(*) FROM maintenance_events WHERE repair_type = 'weekly' AND "статус_ремонта" = 'запланирован') as planned_weekly_repairs;