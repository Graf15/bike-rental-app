-- ====================================================================
-- Migration: Repair System Enhancement
-- Version: 001
-- Date: 2025-01-04
-- Description: Расширение системы ремонтов на базе существующей maintenance_events
-- ====================================================================

BEGIN;

-- ====================================================================
-- 1. РАСШИРЕНИЕ СУЩЕСТВУЮЩЕЙ ТАБЛИЦЫ MAINTENANCE_EVENTS
-- ====================================================================

-- Добавляем новые колонки для расширенной функциональности ремонтов
ALTER TABLE maintenance_events 
ADD COLUMN IF NOT EXISTS repair_type VARCHAR(20) DEFAULT 'current' 
    CHECK (repair_type IN ('current', 'weekly', 'longterm'));

ALTER TABLE maintenance_events 
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 3 
    CHECK (priority BETWEEN 1 AND 5);

ALTER TABLE maintenance_events 
ADD COLUMN IF NOT EXISTS estimated_duration INTEGER DEFAULT 15;

ALTER TABLE maintenance_events 
ADD COLUMN IF NOT EXISTS actual_duration INTEGER;

ALTER TABLE maintenance_events 
ADD COLUMN IF NOT EXISTS estimated_cost DECIMAL(10,2) DEFAULT 0 
    CHECK (estimated_cost >= 0);

ALTER TABLE maintenance_events 
ADD COLUMN IF NOT EXISTS actual_cost DECIMAL(10,2) DEFAULT 0 
    CHECK (actual_cost >= 0);

-- Добавляем комментарии к новым колонкам
COMMENT ON COLUMN maintenance_events.repair_type IS 'Тип ремонта: current, weekly, longterm';
COMMENT ON COLUMN maintenance_events.priority IS 'Приоритет 1-5 (1=критический, 5=низкий)';
COMMENT ON COLUMN maintenance_events.estimated_duration IS 'Оценочное время в минутах';
COMMENT ON COLUMN maintenance_events.actual_duration IS 'Фактическое время в минутах (автоматически)';
COMMENT ON COLUMN maintenance_events.estimated_cost IS 'Предварительная стоимость';
COMMENT ON COLUMN maintenance_events.actual_cost IS 'Фактическая стоимость (автоматически)';

-- ====================================================================
-- 2. ТАБЛИЦА ЕЖЕНЕДЕЛЬНОГО ПЛАНИРОВАНИЯ
-- ====================================================================

CREATE TABLE IF NOT EXISTS weekly_repair_schedule (
    id SERIAL PRIMARY KEY,
    bike_id INTEGER NOT NULL REFERENCES bikes(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    week_interval INTEGER DEFAULT 1 CHECK (week_interval > 0),
    is_active BOOLEAN DEFAULT true,
    last_scheduled DATE,
    next_scheduled DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by_id INTEGER REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT unique_bike_schedule UNIQUE(bike_id)
);

COMMENT ON TABLE weekly_repair_schedule IS 'График еженедельного обслуживания велосипедов';
COMMENT ON COLUMN weekly_repair_schedule.day_of_week IS '1=Понедельник, 7=Воскресенье';
COMMENT ON COLUMN weekly_repair_schedule.week_interval IS 'Интервал в неделях (1=каждую неделю)';

-- ====================================================================
-- 3. ИСТОРИЯ ИЗМЕНЕНИЙ СТАТУСОВ РЕМОНТОВ
-- ====================================================================

CREATE TABLE IF NOT EXISTS repair_status_history (
    id SERIAL PRIMARY KEY,
    repair_id INTEGER NOT NULL REFERENCES maintenance_events(id) ON DELETE CASCADE,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by_id INTEGER REFERENCES users(id),
    changed_at TIMESTAMP DEFAULT NOW(),
    reason TEXT,
    notes TEXT,
    duration_in_previous_status INTEGER,
    
    CONSTRAINT valid_status_change CHECK (old_status IS DISTINCT FROM new_status OR old_status IS NULL)
);

COMMENT ON TABLE repair_status_history IS 'История изменений статусов ремонтов для аудита';
COMMENT ON COLUMN repair_status_history.duration_in_previous_status IS 'Время в предыдущем статусе (минуты)';

-- ====================================================================
-- 4. ИСТОРИЯ СТАТУСОВ ВЕЛОСИПЕДОВ (для учета downtime)
-- ====================================================================

CREATE TABLE IF NOT EXISTS bike_status_history (
    id SERIAL PRIMARY KEY,
    bike_id INTEGER NOT NULL REFERENCES bikes(id) ON DELETE CASCADE,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_at TIMESTAMP DEFAULT NOW(),
    reason VARCHAR(100),
    repair_id INTEGER REFERENCES maintenance_events(id),
    changed_by_id INTEGER REFERENCES users(id),
    duration_in_previous_status INTEGER,
    notes TEXT,
    
    CONSTRAINT valid_bike_status_change CHECK (old_status IS DISTINCT FROM new_status OR old_status IS NULL)
);

COMMENT ON TABLE bike_status_history IS 'История статусов велосипедов для расчета времени простоев';
COMMENT ON COLUMN bike_status_history.reason IS 'Причина: repair, maintenance, rental, stolen, etc.';

-- ====================================================================
-- 5. СОЗДАНИЕ ИНДЕКСОВ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ
-- ====================================================================

-- Индексы для еженедельного планирования
CREATE INDEX IF NOT EXISTS idx_weekly_schedule_active 
    ON weekly_repair_schedule(is_active, next_scheduled) 
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_weekly_schedule_day 
    ON weekly_repair_schedule(day_of_week, is_active);

-- Индексы для истории ремонтов
CREATE INDEX IF NOT EXISTS idx_repair_history_repair 
    ON repair_status_history(repair_id);

CREATE INDEX IF NOT EXISTS idx_repair_history_date 
    ON repair_status_history(changed_at);

CREATE INDEX IF NOT EXISTS idx_repair_history_user 
    ON repair_status_history(changed_by_id);

-- Индексы для истории велосипедов
CREATE INDEX IF NOT EXISTS idx_bike_status_history_bike 
    ON bike_status_history(bike_id);

CREATE INDEX IF NOT EXISTS idx_bike_status_history_date 
    ON bike_status_history(changed_at);

CREATE INDEX IF NOT EXISTS idx_bike_status_history_repair 
    ON bike_status_history(repair_id) 
    WHERE repair_id IS NOT NULL;

-- Индексы для расширенной таблицы ремонтов
CREATE INDEX IF NOT EXISTS idx_maintenance_events_type_status 
    ON maintenance_events(repair_type, "статус_ремонта");

CREATE INDEX IF NOT EXISTS idx_maintenance_events_planned_date 
    ON maintenance_events("ремонт_запланирован_на") 
    WHERE "ремонт_запланирован_на" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_maintenance_events_priority 
    ON maintenance_events(priority, "статус_ремонта");

-- ====================================================================
-- 6. ФУНКЦИИ И ТРИГГЕРЫ ДЛЯ АВТОМАТИЗАЦИИ
-- ====================================================================

-- Функция для логирования изменений статуса ремонта
CREATE OR REPLACE FUNCTION log_repair_status_change()
RETURNS TRIGGER AS $$
DECLARE
    duration_minutes INTEGER;
BEGIN
    -- Логируем изменение статуса ремонта
    IF OLD."статус_ремонта" IS DISTINCT FROM NEW."статус_ремонта" THEN
        -- Вычисляем время в предыдущем статусе
        IF OLD.updated_at IS NOT NULL THEN
            duration_minutes := EXTRACT(EPOCH FROM (NOW() - OLD.updated_at))/60;
        ELSE
            duration_minutes := NULL;
        END IF;
        
        -- Записываем в историю
        INSERT INTO repair_status_history (
            repair_id, old_status, new_status, changed_at, 
            duration_in_previous_status
        ) VALUES (
            NEW.id, 
            OLD."статус_ремонта", 
            NEW."статус_ремонта", 
            NOW(),
            duration_minutes
        );
        
        -- Обновляем статус велосипеда при необходимости
        IF NEW."статус_ремонта" = 'в ремонте' AND NEW.repair_type != 'longterm' THEN
            -- Ремонт начался - велосипед в ремонте (кроме долгосрочных)
            UPDATE bikes SET status = 'в ремонте' WHERE id = NEW.bike_id;
            
            -- Логируем изменение статуса велосипеда
            INSERT INTO bike_status_history (bike_id, old_status, new_status, reason, repair_id)
            SELECT NEW.bike_id, b.status, 'в ремонте', 'repair_started', NEW.id
            FROM bikes b WHERE b.id = NEW.bike_id AND b.status != 'в ремонте';
            
        ELSIF NEW."статус_ремонта" = 'ремонт выполнен' THEN
            -- Ремонт завершен - велосипед доступен
            UPDATE bikes SET 
                status = 'в наличии', 
                last_service_date = CURRENT_DATE 
            WHERE id = NEW.bike_id;
            
            -- Вычисляем фактическое время ремонта
            IF NEW."дата_начала" IS NOT NULL THEN
                NEW.actual_duration := EXTRACT(EPOCH FROM (NOW() - NEW."дата_начала"))/60;
            ELSIF NEW.estimated_duration IS NOT NULL THEN
                NEW.actual_duration := NEW.estimated_duration;
            ELSE
                NEW.actual_duration := 15; -- По умолчанию 15 минут
            END IF;
            
            -- Логируем изменение статуса велосипеда
            INSERT INTO bike_status_history (bike_id, old_status, new_status, reason, repair_id)
            SELECT NEW.bike_id, b.status, 'в наличии', 'repair_completed', NEW.id
            FROM bikes b WHERE b.id = NEW.bike_id AND b.status != 'в наличии';
        END IF;
    END IF;
    
    -- Обновляем timestamp
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для логирования изменений статусов
DROP TRIGGER IF EXISTS trigger_log_repair_status_change ON maintenance_events;
CREATE TRIGGER trigger_log_repair_status_change
    BEFORE UPDATE ON maintenance_events
    FOR EACH ROW
    EXECUTE FUNCTION log_repair_status_change();

-- ====================================================================
-- 7. ФУНКЦИЯ ДЛЯ АВТОМАТИЧЕСКОГО ПЕРЕСЧЕТА СТОИМОСТИ РЕМОНТА
-- ====================================================================

CREATE OR REPLACE FUNCTION update_repair_cost()
RETURNS TRIGGER AS $$
DECLARE
    repair_event_id INTEGER;
BEGIN
    -- Определяем ID события ремонта
    repair_event_id := COALESCE(NEW."событие_id", OLD."событие_id");
    
    -- Пересчитываем общую стоимость ремонта
    UPDATE maintenance_events SET 
        actual_cost = (
            SELECT COALESCE(SUM("использовано" * "цена_за_шт"), 0) 
            FROM maintenance_parts 
            WHERE "событие_id" = repair_event_id
        ),
        updated_at = NOW()
    WHERE id = repair_event_id;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического пересчета стоимости
DROP TRIGGER IF EXISTS trigger_update_repair_cost ON maintenance_parts;
CREATE TRIGGER trigger_update_repair_cost
    AFTER INSERT OR UPDATE OR DELETE ON maintenance_parts
    FOR EACH ROW
    EXECUTE FUNCTION update_repair_cost();

-- ====================================================================
-- 8. ФУНКЦИЯ ДЛЯ ГЕНЕРАЦИИ ЕЖЕНЕДЕЛЬНЫХ РЕМОНТОВ
-- ====================================================================

CREATE OR REPLACE FUNCTION generate_weekly_repairs(target_date DATE DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
    schedule_rec RECORD;
    target_week_start DATE;
    planned_date DATE;
    created_count INTEGER := 0;
BEGIN
    -- Если дата не указана, используем следующий понедельник
    IF target_date IS NULL THEN
        target_week_start := (CURRENT_DATE + INTERVAL '1 week')::DATE - EXTRACT(DOW FROM CURRENT_DATE + INTERVAL '1 week')::INTEGER + 1;
    ELSE
        target_week_start := target_date;
    END IF;
    
    -- Проходим по всем активным расписаниям
    FOR schedule_rec IN 
        SELECT * FROM weekly_repair_schedule 
        WHERE is_active = true 
        AND (last_scheduled IS NULL OR last_scheduled < target_week_start)
    LOOP
        -- Вычисляем дату для конкретного дня недели
        planned_date := target_week_start + (schedule_rec.day_of_week - 1);
        
        -- Проверяем, нет ли уже запланированного ремонта на эту дату
        IF NOT EXISTS (
            SELECT 1 FROM maintenance_events 
            WHERE bike_id = schedule_rec.bike_id 
            AND repair_type = 'weekly'
            AND "статус_ремонта" IN ('запланирован', 'в ремонте', 'ожидает деталей')
        ) THEN
            -- Создаем новое событие ремонта
            INSERT INTO maintenance_events (
                bike_id, 
                repair_type,
                "тип_ремонта", 
                "статус_ремонта", 
                "ремонт_запланирован_на",
                estimated_duration,
                priority,
                "примечания"
            ) VALUES (
                schedule_rec.bike_id,
                'weekly',
                'еженедельное ТО',
                'запланирован',
                planned_date,
                30, -- Стандартное ТО 30 минут
                3,  -- Средний приоритет
                'Автоматически запланированное еженедельное ТО'
            );
            
            -- Обновляем расписание
            UPDATE weekly_repair_schedule 
            SET 
                last_scheduled = target_week_start,
                next_scheduled = target_week_start + INTERVAL '1 week',
                updated_at = NOW()
            WHERE id = schedule_rec.id;
            
            created_count := created_count + 1;
        END IF;
    END LOOP;
    
    RETURN created_count;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- 9. ЗАПОЛНЕНИЕ НАЧАЛЬНЫМИ ДАННЫМИ
-- ====================================================================

-- Обновляем существующие записи maintenance_events значениями по умолчанию
UPDATE maintenance_events 
SET 
    repair_type = 'current',
    priority = 3,
    estimated_duration = 15,
    estimated_cost = 0,
    actual_cost = 0
WHERE repair_type IS NULL;

-- Пересчитываем actual_cost для существующих ремонтов
UPDATE maintenance_events 
SET actual_cost = (
    SELECT COALESCE(SUM("использовано" * "цена_за_шт"), 0) 
    FROM maintenance_parts 
    WHERE "событие_id" = maintenance_events.id
);

-- ====================================================================
-- 10. ПРОВЕРКА ЦЕЛОСТНОСТИ ДАННЫХ
-- ====================================================================

-- Проверяем, что все новые колонки созданы
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'maintenance_events' 
        AND column_name = 'repair_type'
    ) THEN
        RAISE EXCEPTION 'Колонка repair_type не была создана';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'weekly_repair_schedule'
    ) THEN
        RAISE EXCEPTION 'Таблица weekly_repair_schedule не была создана';
    END IF;
    
    RAISE NOTICE 'Миграция выполнена успешно. Создано % таблиц и добавлено % колонок.', 3, 6;
END $$;

COMMIT;

-- ====================================================================
-- ФИНАЛИЗАЦИЯ
-- ====================================================================

-- Обновляем статистику для оптимизатора запросов
ANALYZE maintenance_events;
ANALYZE weekly_repair_schedule;
ANALYZE repair_status_history;
ANALYZE bike_status_history;

-- Выводим финальную информацию
SELECT 
    'Миграция 001_repair_system_enhancement завершена' as status,
    NOW() as completed_at,
    (SELECT COUNT(*) FROM maintenance_events) as total_repairs,
    (SELECT COUNT(*) FROM weekly_repair_schedule) as scheduled_bikes;