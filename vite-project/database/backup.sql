--
-- PostgreSQL database dump for bikerental
-- Generated on 2025-08-17T03:16:10.833Z
-- 
-- Host: localhost:5432
-- Database: bikerental
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: bikerental; Type: DATABASE; Schema: -; Owner: postgres
--

-- CREATE DATABASE bikerental WITH TEMPLATE = template0 ENCODING = 'UTF8' LC_COLLATE = 'en_US.UTF-8' LC_CTYPE = 'en_US.UTF-8';

SET default_tablespace = '';
SET default_table_access_method = heap;

-- =============================================
-- TABLE STRUCTURES
-- =============================================

--
-- Table structure for table bike_status_history
--

DROP TABLE IF EXISTS bike_status_history;
CREATE TABLE bike_status_history (
    id integer NOT NULL DEFAULT nextval('bike_status_history_id_seq'::regclass),
    bike_id integer NOT NULL,
    old_status character varying(50),
    new_status character varying(50) NOT NULL,
    changed_at timestamp without time zone DEFAULT now(),
    reason character varying(100),
    repair_id integer,
    changed_by_id integer,
    duration_in_previous_status integer,
    notes text
);

--
-- Table structure for table bikes
--

DROP TABLE IF EXISTS bikes;
CREATE TABLE bikes (
    id integer NOT NULL DEFAULT nextval('bikes_id_seq'::regclass),
    name character varying(100) NOT NULL,
    model character varying(100),
    brand character varying(50),
    size character varying(10),
    color character varying(30),
    purchase_date date,
    purchase_price numeric,
    status character varying(50) DEFAULT 'в наличии'::character varying,
    condition_rating integer DEFAULT 5,
    last_service_date date,
    service_interval_days integer DEFAULT 30,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

--
-- Table structure for table maintenance_events
--

DROP TABLE IF EXISTS maintenance_events;
CREATE TABLE maintenance_events (
    id integer NOT NULL DEFAULT nextval('maintenance_events_id_seq'::regclass),
    bike_id integer NOT NULL,
    тип_ремонта character varying(100) NOT NULL,
    статус_ремонта character varying(50) DEFAULT 'запланирован'::character varying,
    дата_начала timestamp without time zone,
    дата_окончания timestamp without time zone,
    ремонт_запланирован_на date,
    примечания text,
    исполнитель character varying(100),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    repair_type character varying(20) DEFAULT 'current'::character varying,
    priority integer DEFAULT 3,
    estimated_duration integer DEFAULT 15,
    actual_duration integer,
    estimated_cost numeric DEFAULT 0,
    actual_cost numeric DEFAULT 0,
    менеджер_id integer,
    исполнитель_id integer
);

--
-- Table structure for table maintenance_parts
--

DROP TABLE IF EXISTS maintenance_parts;
CREATE TABLE maintenance_parts (
    id integer NOT NULL DEFAULT nextval('maintenance_parts_id_seq'::regclass),
    событие_id integer NOT NULL,
    part_model_id integer NOT NULL,
    использовано integer NOT NULL,
    цена_за_шт numeric DEFAULT 0,
    notes text,
    created_at timestamp without time zone DEFAULT now()
);

--
-- Table structure for table part_models
--

DROP TABLE IF EXISTS part_models;
CREATE TABLE part_models (
    id integer NOT NULL DEFAULT nextval('part_models_id_seq'::regclass),
    name character varying(100) NOT NULL,
    category character varying(50),
    brand character varying(50),
    model character varying(100),
    description text,
    unit_price numeric DEFAULT 0,
    supplier character varying(100),
    part_number character varying(50),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

--
-- Table structure for table part_stock
--

DROP TABLE IF EXISTS part_stock;
CREATE TABLE part_stock (
    id integer NOT NULL DEFAULT nextval('part_stock_id_seq'::regclass),
    part_model_id integer NOT NULL,
    quantity integer DEFAULT 0,
    min_stock integer DEFAULT 5,
    max_stock integer DEFAULT 100,
    warehouse_location character varying(50),
    last_updated timestamp without time zone DEFAULT now(),
    notes text
);

--
-- Table structure for table purchase_requests
--

DROP TABLE IF EXISTS purchase_requests;
CREATE TABLE purchase_requests (
    id integer NOT NULL DEFAULT nextval('purchase_requests_id_seq'::regclass),
    part_model_id integer NOT NULL,
    requested_quantity integer NOT NULL,
    reason character varying(255),
    status character varying(50) DEFAULT 'pending'::character varying,
    requested_by integer,
    requested_at timestamp without time zone DEFAULT now(),
    approved_by integer,
    approved_at timestamp without time zone,
    notes text,
    urgent boolean DEFAULT false
);

--
-- Table structure for table repair_status_history
--

DROP TABLE IF EXISTS repair_status_history;
CREATE TABLE repair_status_history (
    id integer NOT NULL DEFAULT nextval('repair_status_history_id_seq'::regclass),
    repair_id integer NOT NULL,
    old_status character varying(50),
    new_status character varying(50) NOT NULL,
    changed_by_id integer,
    changed_at timestamp without time zone DEFAULT now(),
    reason text,
    notes text,
    duration_in_previous_status integer
);

--
-- Table structure for table users
--

DROP TABLE IF EXISTS users;
CREATE TABLE users (
    id integer NOT NULL DEFAULT nextval('users_id_seq'::regclass),
    name character varying(100) NOT NULL,
    email character varying(255),
    phone character varying(20),
    role character varying(50) DEFAULT 'employee'::character varying,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

--
-- Table structure for table weekly_repair_schedule
--

DROP TABLE IF EXISTS weekly_repair_schedule;
CREATE TABLE weekly_repair_schedule (
    id integer NOT NULL DEFAULT nextval('weekly_repair_schedule_id_seq'::regclass),
    bike_id integer NOT NULL,
    day_of_week integer NOT NULL,
    week_interval integer DEFAULT 1,
    is_active boolean DEFAULT true,
    last_scheduled date,
    next_scheduled date,
    created_at timestamp without time zone DEFAULT now(),
    created_by_id integer,
    updated_at timestamp without time zone DEFAULT now()
);

-- =============================================
-- SEQUENCES
-- =============================================

--
-- Sequence users_id_seq
--

SELECT setval('users_id_seq', 8, true);

--
-- Sequence bikes_id_seq
--

SELECT setval('bikes_id_seq', 120, true);

--
-- Sequence part_models_id_seq
--

SELECT setval('part_models_id_seq', 20, true);

--
-- Sequence part_stock_id_seq
--

SELECT setval('part_stock_id_seq', 18, true);

--
-- Sequence maintenance_events_id_seq
--

SELECT setval('maintenance_events_id_seq', 16, true);

--
-- Sequence maintenance_parts_id_seq
--

SELECT setval('maintenance_parts_id_seq', 15, true);

--
-- Sequence purchase_requests_id_seq
--

SELECT setval('purchase_requests_id_seq', 8, true);

--
-- Sequence weekly_repair_schedule_id_seq
--

SELECT setval('weekly_repair_schedule_id_seq', 6, true);

--
-- Sequence repair_status_history_id_seq
--

SELECT setval('repair_status_history_id_seq', 5, true);

--
-- Sequence bike_status_history_id_seq
--

SELECT setval('bike_status_history_id_seq', 1, true);

-- =============================================
-- PRIMARY KEYS AND CONSTRAINTS
-- =============================================

--
-- CHECK constraint 2200_16602_1_not_null on table bike_status_history
--

--
-- CHECK constraint 2200_16602_2_not_null on table bike_status_history
--

--
-- CHECK constraint 2200_16602_4_not_null on table bike_status_history
--

--
-- CHECK constraint valid_bike_status_change on table bike_status_history
--

--
-- FOREIGN KEY constraint bike_status_history_bike_id_fkey on table bike_status_history
--

ALTER TABLE ONLY bike_status_history
    ADD CONSTRAINT bike_status_history_bike_id_fkey FOREIGN KEY (bike_id) REFERENCES bikes ON DELETE CASCADE;

--
-- FOREIGN KEY constraint bike_status_history_changed_by_id_fkey on table bike_status_history
--

ALTER TABLE ONLY bike_status_history
    ADD CONSTRAINT bike_status_history_changed_by_id_fkey FOREIGN KEY (changed_by_id) REFERENCES users;

--
-- FOREIGN KEY constraint bike_status_history_repair_id_fkey on table bike_status_history
--

ALTER TABLE ONLY bike_status_history
    ADD CONSTRAINT bike_status_history_repair_id_fkey FOREIGN KEY (repair_id) REFERENCES maintenance_events;

--
-- PRIMARY KEY constraint bike_status_history_pkey on table bike_status_history
--

ALTER TABLE ONLY bike_status_history
    ADD CONSTRAINT bike_status_history_pkey PRIMARY KEY (id);

--
-- CHECK constraint 2200_16418_1_not_null on table bikes
--

--
-- CHECK constraint 2200_16418_2_not_null on table bikes
--

--
-- CHECK constraint bikes_condition_rating_check on table bikes
--

--
-- PRIMARY KEY constraint bikes_pkey on table bikes
--

ALTER TABLE ONLY bikes
    ADD CONSTRAINT bikes_pkey PRIMARY KEY (id);

--
-- CHECK constraint 2200_16464_1_not_null on table maintenance_events
--

--
-- CHECK constraint 2200_16464_2_not_null on table maintenance_events
--

--
-- CHECK constraint 2200_16464_3_not_null on table maintenance_events
--

--
-- CHECK constraint maintenance_events_actual_cost_check on table maintenance_events
--

--
-- CHECK constraint maintenance_events_estimated_cost_check on table maintenance_events
--

--
-- CHECK constraint maintenance_events_priority_check on table maintenance_events
--

--
-- CHECK constraint maintenance_events_repair_type_check on table maintenance_events
--

--
-- FOREIGN KEY constraint maintenance_events_bike_id_fkey on table maintenance_events
--

ALTER TABLE ONLY maintenance_events
    ADD CONSTRAINT maintenance_events_bike_id_fkey FOREIGN KEY (bike_id) REFERENCES bikes ON DELETE CASCADE;

--
-- FOREIGN KEY constraint maintenance_events_исполнитель_id_fkey on table maintenance_events
--

ALTER TABLE ONLY maintenance_events
    ADD CONSTRAINT maintenance_events_исполнитель_id_fkey FOREIGN KEY (исполнитель_id) REFERENCES users;

--
-- FOREIGN KEY constraint maintenance_events_менеджер_id_fkey on table maintenance_events
--

ALTER TABLE ONLY maintenance_events
    ADD CONSTRAINT maintenance_events_менеджер_id_fkey FOREIGN KEY (менеджер_id) REFERENCES users;

--
-- PRIMARY KEY constraint maintenance_events_pkey on table maintenance_events
--

ALTER TABLE ONLY maintenance_events
    ADD CONSTRAINT maintenance_events_pkey PRIMARY KEY (id);

--
-- CHECK constraint 2200_16481_1_not_null on table maintenance_parts
--

--
-- CHECK constraint 2200_16481_2_not_null on table maintenance_parts
--

--
-- CHECK constraint 2200_16481_3_not_null on table maintenance_parts
--

--
-- CHECK constraint 2200_16481_4_not_null on table maintenance_parts
--

--
-- CHECK constraint maintenance_parts_использовано_check on table maintenance_parts
--

--
-- FOREIGN KEY constraint maintenance_parts_part_model_id_fkey on table maintenance_parts
--

ALTER TABLE ONLY maintenance_parts
    ADD CONSTRAINT maintenance_parts_part_model_id_fkey FOREIGN KEY (part_model_id) REFERENCES part_models;

--
-- FOREIGN KEY constraint maintenance_parts_событие_id_fkey on table maintenance_parts
--

ALTER TABLE ONLY maintenance_parts
    ADD CONSTRAINT maintenance_parts_событие_id_fkey FOREIGN KEY (событие_id) REFERENCES maintenance_events ON DELETE CASCADE;

--
-- PRIMARY KEY constraint maintenance_parts_pkey on table maintenance_parts
--

ALTER TABLE ONLY maintenance_parts
    ADD CONSTRAINT maintenance_parts_pkey PRIMARY KEY (id);

--
-- CHECK constraint 2200_16433_1_not_null on table part_models
--

--
-- CHECK constraint 2200_16433_2_not_null on table part_models
--

--
-- PRIMARY KEY constraint part_models_pkey on table part_models
--

ALTER TABLE ONLY part_models
    ADD CONSTRAINT part_models_pkey PRIMARY KEY (id);

--
-- CHECK constraint 2200_16445_1_not_null on table part_stock
--

--
-- CHECK constraint 2200_16445_2_not_null on table part_stock
--

--
-- CHECK constraint part_stock_quantity_check on table part_stock
--

--
-- FOREIGN KEY constraint part_stock_part_model_id_fkey on table part_stock
--

ALTER TABLE ONLY part_stock
    ADD CONSTRAINT part_stock_part_model_id_fkey FOREIGN KEY (part_model_id) REFERENCES part_models ON DELETE CASCADE;

--
-- PRIMARY KEY constraint part_stock_pkey on table part_stock
--

ALTER TABLE ONLY part_stock
    ADD CONSTRAINT part_stock_pkey PRIMARY KEY (id);

--
-- CHECK constraint 2200_16503_1_not_null on table purchase_requests
--

--
-- CHECK constraint 2200_16503_2_not_null on table purchase_requests
--

--
-- CHECK constraint 2200_16503_3_not_null on table purchase_requests
--

--
-- CHECK constraint purchase_requests_requested_quantity_check on table purchase_requests
--

--
-- FOREIGN KEY constraint purchase_requests_approved_by_fkey on table purchase_requests
--

ALTER TABLE ONLY purchase_requests
    ADD CONSTRAINT purchase_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES users;

--
-- FOREIGN KEY constraint purchase_requests_part_model_id_fkey on table purchase_requests
--

ALTER TABLE ONLY purchase_requests
    ADD CONSTRAINT purchase_requests_part_model_id_fkey FOREIGN KEY (part_model_id) REFERENCES part_models ON DELETE CASCADE;

--
-- FOREIGN KEY constraint purchase_requests_requested_by_fkey on table purchase_requests
--

ALTER TABLE ONLY purchase_requests
    ADD CONSTRAINT purchase_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES users;

--
-- PRIMARY KEY constraint purchase_requests_pkey on table purchase_requests
--

ALTER TABLE ONLY purchase_requests
    ADD CONSTRAINT purchase_requests_pkey PRIMARY KEY (id);

--
-- CHECK constraint 2200_16581_1_not_null on table repair_status_history
--

--
-- CHECK constraint 2200_16581_2_not_null on table repair_status_history
--

--
-- CHECK constraint 2200_16581_4_not_null on table repair_status_history
--

--
-- CHECK constraint valid_status_change on table repair_status_history
--

--
-- FOREIGN KEY constraint repair_status_history_changed_by_id_fkey on table repair_status_history
--

ALTER TABLE ONLY repair_status_history
    ADD CONSTRAINT repair_status_history_changed_by_id_fkey FOREIGN KEY (changed_by_id) REFERENCES users;

--
-- FOREIGN KEY constraint repair_status_history_repair_id_fkey on table repair_status_history
--

ALTER TABLE ONLY repair_status_history
    ADD CONSTRAINT repair_status_history_repair_id_fkey FOREIGN KEY (repair_id) REFERENCES maintenance_events ON DELETE CASCADE;

--
-- PRIMARY KEY constraint repair_status_history_pkey on table repair_status_history
--

ALTER TABLE ONLY repair_status_history
    ADD CONSTRAINT repair_status_history_pkey PRIMARY KEY (id);

--
-- CHECK constraint 2200_16405_1_not_null on table users
--

--
-- CHECK constraint 2200_16405_2_not_null on table users
--

--
-- PRIMARY KEY constraint users_pkey on table users
--

ALTER TABLE ONLY users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

--
-- UNIQUE constraint users_email_key on table users
--

ALTER TABLE ONLY users
    ADD CONSTRAINT users_email_key UNIQUE (email);

--
-- CHECK constraint 2200_16556_1_not_null on table weekly_repair_schedule
--

--
-- CHECK constraint 2200_16556_2_not_null on table weekly_repair_schedule
--

--
-- CHECK constraint 2200_16556_3_not_null on table weekly_repair_schedule
--

--
-- CHECK constraint weekly_repair_schedule_day_of_week_check on table weekly_repair_schedule
--

--
-- CHECK constraint weekly_repair_schedule_week_interval_check on table weekly_repair_schedule
--

--
-- FOREIGN KEY constraint weekly_repair_schedule_bike_id_fkey on table weekly_repair_schedule
--

ALTER TABLE ONLY weekly_repair_schedule
    ADD CONSTRAINT weekly_repair_schedule_bike_id_fkey FOREIGN KEY (bike_id) REFERENCES bikes ON DELETE CASCADE;

--
-- FOREIGN KEY constraint weekly_repair_schedule_created_by_id_fkey on table weekly_repair_schedule
--

ALTER TABLE ONLY weekly_repair_schedule
    ADD CONSTRAINT weekly_repair_schedule_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES users;

--
-- PRIMARY KEY constraint weekly_repair_schedule_pkey on table weekly_repair_schedule
--

ALTER TABLE ONLY weekly_repair_schedule
    ADD CONSTRAINT weekly_repair_schedule_pkey PRIMARY KEY (id);

--
-- UNIQUE constraint unique_bike_schedule on table weekly_repair_schedule
--

ALTER TABLE ONLY weekly_repair_schedule
    ADD CONSTRAINT unique_bike_schedule UNIQUE (bike_id);

-- =============================================
-- INDEXES
-- =============================================

--
-- Index idx_bike_status_history_bike on table bike_status_history
--

CREATE INDEX idx_bike_status_history_bike ON public.bike_status_history USING btree (bike_id);

--
-- Index idx_bike_status_history_date on table bike_status_history
--

CREATE INDEX idx_bike_status_history_date ON public.bike_status_history USING btree (changed_at);

--
-- Index idx_bike_status_history_repair on table bike_status_history
--

CREATE INDEX idx_bike_status_history_repair ON public.bike_status_history USING btree (repair_id) WHERE (repair_id IS NOT NULL);

--
-- Index idx_maintenance_events_planned_date on table maintenance_events
--

CREATE INDEX idx_maintenance_events_planned_date ON public.maintenance_events USING btree ("ремонт_запланирован_на") WHERE ("ремонт_запланирован_на" IS NOT NULL);

--
-- Index idx_maintenance_events_priority on table maintenance_events
--

CREATE INDEX idx_maintenance_events_priority ON public.maintenance_events USING btree (priority, "статус_ремонта");

--
-- Index idx_maintenance_events_type_status on table maintenance_events
--

CREATE INDEX idx_maintenance_events_type_status ON public.maintenance_events USING btree (repair_type, "статус_ремонта");

--
-- Index idx_repair_history_date on table repair_status_history
--

CREATE INDEX idx_repair_history_date ON public.repair_status_history USING btree (changed_at);

--
-- Index idx_repair_history_repair on table repair_status_history
--

CREATE INDEX idx_repair_history_repair ON public.repair_status_history USING btree (repair_id);

--
-- Index idx_repair_history_user on table repair_status_history
--

CREATE INDEX idx_repair_history_user ON public.repair_status_history USING btree (changed_by_id);

--
-- Index users_email_key on table users
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);

--
-- Index idx_weekly_schedule_active on table weekly_repair_schedule
--

CREATE INDEX idx_weekly_schedule_active ON public.weekly_repair_schedule USING btree (is_active, next_scheduled) WHERE (is_active = true);

--
-- Index idx_weekly_schedule_day on table weekly_repair_schedule
--

CREATE INDEX idx_weekly_schedule_day ON public.weekly_repair_schedule USING btree (day_of_week, is_active);

--
-- Index unique_bike_schedule on table weekly_repair_schedule
--

CREATE UNIQUE INDEX unique_bike_schedule ON public.weekly_repair_schedule USING btree (bike_id);

-- =============================================
-- FUNCTIONS AND TRIGGERS
-- =============================================

--
-- Function generate_weekly_repairs
--


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


--
-- Function log_repair_status_change
--


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


--
-- Function update_repair_cost
--


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


--
-- Trigger trigger_log_repair_status_change on table maintenance_events
--

CREATE TRIGGER trigger_log_repair_status_change
    BEFORE UPDATE ON maintenance_events
    FOR EACH ROW EXECUTE FUNCTION log_repair_status_change();

--
-- Trigger trigger_update_repair_cost on table maintenance_parts
--

CREATE TRIGGER trigger_update_repair_cost
    AFTER INSERT ON maintenance_parts
    FOR EACH ROW EXECUTE FUNCTION update_repair_cost();

--
-- Trigger trigger_update_repair_cost on table maintenance_parts
--

CREATE TRIGGER trigger_update_repair_cost
    AFTER DELETE ON maintenance_parts
    FOR EACH ROW EXECUTE FUNCTION update_repair_cost();

--
-- Trigger trigger_update_repair_cost on table maintenance_parts
--

CREATE TRIGGER trigger_update_repair_cost
    AFTER UPDATE ON maintenance_parts
    FOR EACH ROW EXECUTE FUNCTION update_repair_cost();

-- =============================================
-- TABLE DATA
-- =============================================

--
-- Data for table bikes
--

INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (1, 'Test Bike', 'Test Model', NULL, NULL, NULL, '2025-08-07T21:00:00.000Z', NULL, 'в наличии', 5, '2025-08-07T21:00:00.000Z', 30, NULL, '2025-08-08T16:23:50.379Z', '2025-08-08T16:23:50.379Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (2, 'Trek Mountain Explorer', 'X-Caliber 8', 'Trek', 'M', 'Синий', '2023-03-14T22:00:00.000Z', '85000.00', 'в наличии', 5, NULL, 30, NULL, '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (3, 'Giant Road Racer', 'Defy Advanced 2', 'Giant', 'L', 'Черный', '2023-01-19T22:00:00.000Z', '120000.00', 'арендован', 4, NULL, 30, NULL, '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (4, 'Specialized City Cruiser', 'Sirrus X 3.0', 'Specialized', 'S', 'Красный', '2022-11-09T22:00:00.000Z', '95000.00', 'в наличии', 5, NULL, 30, NULL, '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (5, 'Merida All-Terrain', 'Big.Nine 500', 'Merida', 'XL', 'Зеленый', '2023-05-07T21:00:00.000Z', '75000.00', 'в ремонте', 3, NULL, 30, NULL, '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (6, 'Cannondale Urban', 'Quick CX 3', 'Cannondale', 'M', 'Белый', '2023-02-13T22:00:00.000Z', '68000.00', 'в наличии', 4, NULL, 30, NULL, '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (7, 'Scott Mountain Pro', 'Aspect 940', 'Scott', 'L', 'Оранжевый', '2022-12-04T22:00:00.000Z', '82000.00', 'арендован', 5, NULL, 30, NULL, '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (8, 'Cube Hybrid', 'Nature Hybrid One', 'Cube', 'M', 'Серый', '2023-04-21T21:00:00.000Z', '105000.00', 'в наличии', 4, NULL, 30, NULL, '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (9, 'GT Urban Rider', 'Transeo Comp', 'GT', 'S', 'Синий', '2022-10-17T21:00:00.000Z', '55000.00', 'в ремонте', 2, NULL, 30, NULL, '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (10, 'KTM Adventure', 'Chicago Disc 291', 'KTM', 'L', 'Черный', '2023-06-11T21:00:00.000Z', '78000.00', 'в наличии', 5, NULL, 30, NULL, '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (11, 'Bianchi Classic', 'C-Sport 1', 'Bianchi', 'M', 'Белый', '2023-01-07T22:00:00.000Z', '92000.00', 'арендован', 4, NULL, 30, NULL, '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (12, 'Stels Navigator', 'Navigator 600 MD', 'Stels', 'XL', 'Зеленый', '2022-09-24T21:00:00.000Z', '35000.00', 'в наличии', 3, NULL, 30, NULL, '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (13, 'Forward City Bike', 'Barcelona 2.0', 'Forward', 'S', 'Розовый', '2023-03-29T21:00:00.000Z', '28000.00', 'в наличии', 5, NULL, 30, NULL, '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (14, 'Kona Trail', 'Process 134', 'Kona', 'L', 'Оранжевый', '2023-06-30T21:00:00.000Z', '140000.00', 'в ремонте', 4, NULL, 30, NULL, '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (15, 'Norco Endurance', 'Search XR C2', 'Norco', 'M', 'Серый', '2022-11-27T22:00:00.000Z', '115000.00', 'в наличии', 4, NULL, 30, NULL, '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (16, 'Felt Speed', 'Verza Speed 40', 'Felt', 'S', 'Красный', '2023-02-19T22:00:00.000Z', '72000.00', 'арендован', 5, NULL, 30, NULL, '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (17, 'Trek Thunder 2018', 'Road Runner', 'Trek', 'XXL', 'черный', '2024-06-27T21:00:00.000Z', '46978.00', 'в прокате', 5, '2025-03-05T22:00:00.000Z', 79, 'Заменены грипсы', '2025-08-17T00:52:11.126Z', '2025-08-17T00:52:11.126Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (18, 'Orbea Thunder 2021', 'Cross Country', 'Orbea', '27.5"', 'фиолетовый', '2025-01-10T22:00:00.000Z', '61712.00', 'в прокате', 4, '2025-06-23T21:00:00.000Z', 35, 'Заменена цепь', '2025-08-17T00:52:11.137Z', '2025-08-17T00:52:11.137Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (19, 'Schwinn Storm 2019', 'Adventure', 'Schwinn', 'XL', 'красный', '2025-04-14T21:00:00.000Z', '46781.00', 'в наличии', 4, '2025-02-17T22:00:00.000Z', 78, 'Смазаны подшипники', '2025-08-17T00:52:11.138Z', '2025-08-17T00:52:11.138Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (20, 'Bianchi Lightning 2018', 'Cross Country', 'Bianchi', 'д24', 'розовый', '2024-12-19T22:00:00.000Z', '55292.00', 'в ремонте', 3, '2025-08-07T21:00:00.000Z', 87, 'Отрегулированы тормоза', '2025-08-17T00:52:11.139Z', '2025-08-17T00:52:11.139Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (21, 'Norco Urban Elite 2019', 'Mountain Pro', 'Norco', 'XXL', 'белый', '2024-09-17T21:00:00.000Z', '138322.00', 'требует ремонта', 2, '2025-06-22T21:00:00.000Z', 49, 'Заменены покрышки', '2025-08-17T00:52:11.140Z', '2025-08-17T00:52:11.140Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (22, 'Orbea Urban Elite 2018', 'Blaze', 'Orbea', 'д20', 'серый', '2024-03-28T22:00:00.000Z', '13332.00', 'в наличии', 4, '2025-08-01T21:00:00.000Z', 60, 'Заменены тросики', '2025-08-17T00:52:11.140Z', '2025-08-17T00:52:11.140Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (23, 'Orbea Mountain Pro 2020', 'Enduro Beast', 'Orbea', 'XS', 'синий', '2024-06-29T21:00:00.000Z', '17404.00', 'требует ремонта', 2, '2025-07-31T21:00:00.000Z', 43, 'Отремонтирован задний переключатель', '2025-08-17T00:52:11.141Z', '2025-08-17T00:52:11.141Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (24, 'Cannondale X-Trail 2023', 'Warrior', 'Cannondale', '26"', 'оранжевый', '2025-03-02T22:00:00.000Z', '126497.00', 'бронь', 3, '2025-05-07T21:00:00.000Z', 47, 'Заменен переключатель', '2025-08-17T00:52:11.142Z', '2025-08-17T00:52:11.142Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (25, 'Bulls Sport 2024', 'Urban Elite', 'Bulls', 'д24', 'красный', '2024-04-19T21:00:00.000Z', '158481.00', 'в наличии', 1, '2025-03-16T22:00:00.000Z', 60, 'Проверено состояние вилки', '2025-08-17T00:52:11.143Z', '2025-08-17T00:52:11.143Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (26, 'Norco Adventure 2024', 'Blaze', 'Norco', 'S', 'красный', '2023-11-06T22:00:00.000Z', '122851.00', 'бронь', 5, '2025-03-16T22:00:00.000Z', 83, 'Плановое ТО пройдено', '2025-08-17T00:52:11.144Z', '2025-08-17T00:52:11.144Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (27, 'Santa Cruz Thunder 2018', 'Mountain Pro', 'Santa Cruz', '20"', 'серый', '2024-04-01T21:00:00.000Z', '55275.00', 'в ремонте', 4, '2025-07-30T21:00:00.000Z', 44, 'Отрегулирована высота седла', '2025-08-17T00:52:11.144Z', '2025-08-17T00:52:11.144Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (28, 'Canyon Speed Demon 2023', 'Cross Country', 'Canyon', '20"', 'серый', '2025-06-30T21:00:00.000Z', '19101.00', 'в наличии', 4, '2025-08-03T21:00:00.000Z', 47, 'Отрегулирована высота седла', '2025-08-17T00:52:11.145Z', '2025-08-17T00:52:11.145Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (29, 'Bulls Sport 2020', 'Road Runner', 'Bulls', 'д24', 'зеленый', '2025-02-05T22:00:00.000Z', '157725.00', 'в ремонте', 5, '2025-07-30T21:00:00.000Z', 74, 'Смазаны подшипники', '2025-08-17T00:52:11.145Z', '2025-08-17T00:52:11.145Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (30, 'Merida Adventure 2018', 'Storm', 'Merida', 'д20', 'черный', '2025-06-18T21:00:00.000Z', '97009.00', 'в прокате', 5, '2025-03-17T22:00:00.000Z', 41, 'Плановое ТО пройдено', '2025-08-17T00:52:11.146Z', '2025-08-17T00:52:11.146Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (31, 'Scott Warrior 2019', 'Pro', 'Scott', 'XL', 'оранжевый', '2024-06-11T21:00:00.000Z', '121904.00', 'в ремонте', 3, '2025-03-16T22:00:00.000Z', 67, 'Проверено состояние вилки', '2025-08-17T00:52:11.147Z', '2025-08-17T00:52:11.147Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (32, 'Specialized Storm 2021', 'Cross Country', 'Specialized', '29"', 'оранжевый', '2024-02-07T22:00:00.000Z', '60286.00', 'требует ремонта', 1, '2025-07-16T21:00:00.000Z', 70, 'Требует замены тормозных колодок', '2025-08-17T00:52:11.147Z', '2025-08-17T00:52:11.147Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (33, 'Bianchi Enduro Beast 2023', 'Blaze', 'Bianchi', 'д24', 'белый', '2025-07-15T21:00:00.000Z', '104359.00', 'в наличии', 5, '2025-07-04T21:00:00.000Z', 65, 'Настроена подвеска', '2025-08-17T00:52:11.148Z', '2025-08-17T00:52:11.148Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (34, 'Giant Pro 2021', 'Pro', 'Giant', '26"', 'желтый', '2024-07-21T21:00:00.000Z', '153833.00', 'бронь', 1, '2025-03-01T22:00:00.000Z', 41, 'Отрегулирована высота седла', '2025-08-17T00:52:11.149Z', '2025-08-17T00:52:11.149Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (35, 'Norco Mountain Pro 2024', 'Elite', 'Norco', 'д24', 'синий', '2025-04-20T21:00:00.000Z', '155143.00', 'в ремонте', 5, '2025-06-28T21:00:00.000Z', 43, 'Заменена кассета', '2025-08-17T00:52:11.149Z', '2025-08-17T00:52:11.149Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (36, 'Focus X-Trail 2019', 'Enduro Beast', 'Focus', '27.5"', 'розовый', '2024-01-16T22:00:00.000Z', '28901.00', 'в ремонте', 2, '2025-03-12T22:00:00.000Z', 49, 'Отрегулированы тормоза', '2025-08-17T00:52:11.150Z', '2025-08-17T00:52:11.150Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (37, 'Orbea Enduro Beast 2020', 'Road Runner', 'Orbea', 'S', 'желтый', '2023-12-11T22:00:00.000Z', '46606.00', 'в наличии', 4, '2025-03-04T22:00:00.000Z', 60, 'Отремонтирован задний переключатель', '2025-08-17T00:52:11.150Z', '2025-08-17T00:52:11.150Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (38, 'GT Thunder 2022', 'Enduro Beast', 'GT', '26"', 'черный', '2025-07-23T21:00:00.000Z', '27970.00', 'требует ремонта', 2, '2025-03-23T22:00:00.000Z', 75, 'Плановое ТО пройдено', '2025-08-17T00:52:11.151Z', '2025-08-17T00:52:11.151Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (39, 'Schwinn Explorer 2018', 'Road Runner', 'Schwinn', 'XS', 'желтый', '2025-02-13T22:00:00.000Z', '44858.00', 'бронь', 4, '2025-07-22T21:00:00.000Z', 33, 'Заменены покрышки', '2025-08-17T00:52:11.151Z', '2025-08-17T00:52:11.151Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (40, 'Orbea Hybrid Plus 2024', 'Cross Country', 'Orbea', 'д24', 'зеленый', '2025-03-15T22:00:00.000Z', '151312.00', 'в прокате', 5, '2025-05-29T21:00:00.000Z', 85, 'Отрегулированы тормоза', '2025-08-17T00:52:11.152Z', '2025-08-17T00:52:11.152Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (41, 'Specialized Urban Elite 2020', 'Lightning', 'Specialized', '20"', 'синий', '2025-04-15T21:00:00.000Z', '127840.00', 'требует ремонта', 4, '2025-04-15T21:00:00.000Z', 53, 'Плановое ТО пройдено', '2025-08-17T00:52:11.152Z', '2025-08-17T00:52:11.152Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (42, 'Fuji Thunder 2020', 'X-Trail', 'Fuji', 'M', 'красный', '2025-03-27T22:00:00.000Z', '61300.00', 'требует ремонта', 3, '2025-05-19T21:00:00.000Z', 42, 'Настроена передача', '2025-08-17T00:52:11.153Z', '2025-08-17T00:52:11.153Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (43, 'Merida Blaze 2020', 'City Cruiser', 'Merida', 'XL', 'белый', '2025-05-26T21:00:00.000Z', '100287.00', 'бронь', 5, '2025-06-03T21:00:00.000Z', 46, 'Заменены покрышки', '2025-08-17T00:52:11.153Z', '2025-08-17T00:52:11.153Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (44, 'Scott Speed Demon 2021', 'Mountain Pro', 'Scott', 'XXL', 'желтый', '2025-08-13T21:00:00.000Z', '115159.00', 'в наличии', 2, '2025-08-06T21:00:00.000Z', 84, 'Проведена полная диагностика', '2025-08-17T00:52:11.155Z', '2025-08-17T00:52:11.155Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (45, 'Specialized Warrior 2021', 'Speed Demon', 'Specialized', '29"', 'желтый', '2025-03-15T22:00:00.000Z', '55563.00', 'в ремонте', 3, '2025-02-18T22:00:00.000Z', 63, 'Проверен и смазан привод', '2025-08-17T00:52:11.156Z', '2025-08-17T00:52:11.156Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (46, 'Schwinn Warrior 2024', 'Enduro Beast', 'Schwinn', 'XS', 'серый', '2024-09-19T21:00:00.000Z', '84437.00', 'в наличии', 4, '2025-07-21T21:00:00.000Z', 36, 'Проведена полная диагностика', '2025-08-17T00:52:11.156Z', '2025-08-17T00:52:11.156Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (47, 'KTM Speed Demon 2022', 'Adventure', 'KTM', 'д20', 'белый', '2024-06-24T21:00:00.000Z', '51309.00', 'в прокате', 4, '2025-06-21T21:00:00.000Z', 63, 'Проверено состояние вилки', '2025-08-17T00:52:11.157Z', '2025-08-17T00:52:11.157Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (48, 'Bulls Blaze 2024', 'Elite', 'Bulls', 'S', 'красный', '2024-04-12T21:00:00.000Z', '19867.00', 'в ремонте', 3, '2025-07-18T21:00:00.000Z', 77, 'Плановое ТО пройдено', '2025-08-17T00:52:11.157Z', '2025-08-17T00:52:11.157Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (49, 'Mongoose Pro 2024', 'Trail Master', 'Mongoose', 'M', 'белый', '2024-11-06T22:00:00.000Z', '86776.00', 'в ремонте', 3, '2025-08-10T21:00:00.000Z', 70, 'Проверена рама на трещины', '2025-08-17T00:52:11.158Z', '2025-08-17T00:52:11.158Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (50, 'Fuji Lightning 2024', 'Enduro Beast', 'Fuji', '27.5"', 'желтый', '2024-07-04T21:00:00.000Z', '14951.00', 'требует ремонта', 3, '2025-05-22T21:00:00.000Z', 50, 'Проверен и смазан привод', '2025-08-17T00:52:11.158Z', '2025-08-17T00:52:11.158Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (51, 'Orbea Lightning 2021', 'Thunder', 'Orbea', '29"', 'белый', '2025-05-19T21:00:00.000Z', '148866.00', 'в прокате', 3, '2025-07-08T21:00:00.000Z', 68, 'Заменена цепь', '2025-08-17T00:52:11.159Z', '2025-08-17T00:52:11.159Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (52, 'Schwinn Mountain Pro 2024', 'Enduro Beast', 'Schwinn', 'XS', 'красный', '2024-02-26T22:00:00.000Z', '97239.00', 'в прокате', 1, '2025-03-10T22:00:00.000Z', 43, 'Настроена подвеска', '2025-08-17T00:52:11.159Z', '2025-08-17T00:52:11.159Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (53, 'Fuji Speed Demon 2020', 'Enduro Beast', 'Fuji', 'M', 'красный', '2024-03-15T22:00:00.000Z', '45833.00', 'требует ремонта', 4, '2025-02-24T22:00:00.000Z', 63, 'Настроена передача', '2025-08-17T00:52:11.160Z', '2025-08-17T00:52:11.160Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (54, 'Diamondback Explorer 2023', 'Trail Master', 'Diamondback', '24"', 'розовый', '2024-12-20T22:00:00.000Z', '98541.00', 'в ремонте', 1, '2025-06-11T21:00:00.000Z', 85, 'Заменены покрышки', '2025-08-17T00:52:11.160Z', '2025-08-17T00:52:11.160Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (55, 'Scott Lightning 2019', 'Urban Elite', 'Scott', '29"', 'желтый', '2024-11-12T22:00:00.000Z', '84491.00', 'в наличии', 5, '2025-06-27T21:00:00.000Z', 71, 'Заменен переключатель', '2025-08-17T00:52:11.161Z', '2025-08-17T00:52:11.161Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (56, 'Cannondale Storm 2022', 'Blaze', 'Cannondale', 'XS', 'зеленый', '2023-12-11T22:00:00.000Z', '132092.00', 'в ремонте', 3, '2025-05-04T21:00:00.000Z', 33, 'Отремонтирован задний переключатель', '2025-08-17T00:52:11.161Z', '2025-08-17T00:52:11.161Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (57, 'Canyon Sport 2022', 'Elite', 'Canyon', '29"', 'красный', '2023-11-01T22:00:00.000Z', '150736.00', 'бронь', 1, '2025-03-17T22:00:00.000Z', 33, 'Заменена цепь', '2025-08-17T00:52:11.162Z', '2025-08-17T00:52:11.162Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (58, 'Scott Thunder 2022', 'Speed Demon', 'Scott', 'д24', 'оранжевый', '2024-01-13T22:00:00.000Z', '112059.00', 'в наличии', 3, '2025-07-05T21:00:00.000Z', 56, 'Проверено состояние вилки', '2025-08-17T00:52:11.162Z', '2025-08-17T00:52:11.162Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (59, 'Bulls Elite 2022', 'City Cruiser', 'Bulls', '26"', 'фиолетовый', '2024-02-17T22:00:00.000Z', '52293.00', 'в наличии', 4, '2025-07-29T21:00:00.000Z', 40, 'Заменены покрышки', '2025-08-17T00:52:11.163Z', '2025-08-17T00:52:11.163Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (60, 'Diamondback Lightning 2024', 'Explorer', 'Diamondback', '26"', 'серый', '2025-02-02T22:00:00.000Z', '53505.00', 'бронь', 1, '2025-03-08T22:00:00.000Z', 52, 'Отремонтирован задний переключатель', '2025-08-17T00:52:11.163Z', '2025-08-17T00:52:11.163Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (61, 'Specialized X-Trail 2020', 'Warrior', 'Specialized', 'д20', 'черный', '2024-01-09T22:00:00.000Z', '96126.00', 'в ремонте', 1, '2025-08-02T21:00:00.000Z', 53, 'Настроена передача', '2025-08-17T00:52:11.164Z', '2025-08-17T00:52:11.164Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (62, 'Cannondale Thunder 2023', 'Blaze', 'Cannondale', 'XXL', 'фиолетовый', '2024-09-09T21:00:00.000Z', '11050.00', 'требует ремонта', 1, '2025-04-23T21:00:00.000Z', 67, 'Проверено состояние вилки', '2025-08-17T00:52:11.164Z', '2025-08-17T00:52:11.164Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (63, 'Trek Storm 2023', 'City Cruiser', 'Trek', '24"', 'синий', '2024-10-14T21:00:00.000Z', '133335.00', 'в наличии', 5, '2025-07-07T21:00:00.000Z', 65, 'Отремонтирован задний переключатель', '2025-08-17T00:52:11.165Z', '2025-08-17T00:52:11.165Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (64, 'Diamondback Blaze 2023', 'Mountain Pro', 'Diamondback', 'д20', 'фиолетовый', '2024-08-03T21:00:00.000Z', '11543.00', 'в наличии', 3, '2025-03-20T22:00:00.000Z', 48, 'Настроена подвеска', '2025-08-17T00:52:11.165Z', '2025-08-17T00:52:11.165Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (65, 'GT Cross Country 2021', 'Warrior', 'GT', 'д24', 'черный', '2024-09-13T21:00:00.000Z', '116088.00', 'в ремонте', 1, '2025-07-25T21:00:00.000Z', 48, 'Отремонтирован задний переключатель', '2025-08-17T00:52:11.166Z', '2025-08-17T00:52:11.166Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (66, 'Diamondback Sport 2021', 'Enduro Beast', 'Diamondback', 'д20', 'желтый', '2025-05-24T21:00:00.000Z', '145194.00', 'в наличии', 4, '2025-08-06T21:00:00.000Z', 75, 'Настроена геометрия руля', '2025-08-17T00:52:11.166Z', '2025-08-17T00:52:11.166Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (67, 'Bulls Storm 2021', 'Storm', 'Bulls', 'XL', 'оранжевый', '2024-08-12T21:00:00.000Z', '41877.00', 'требует ремонта', 2, '2025-02-27T22:00:00.000Z', 75, 'Отрегулирована высота седла', '2025-08-17T00:52:11.167Z', '2025-08-17T00:52:11.167Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (68, 'Merida Pro 2024', 'Thunder', 'Merida', 'д24', 'белый', '2024-08-11T21:00:00.000Z', '93233.00', 'требует ремонта', 4, '2025-02-17T22:00:00.000Z', 46, 'Отремонтирован задний переключатель', '2025-08-17T00:52:11.167Z', '2025-08-17T00:52:11.167Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (69, 'Focus Road Runner 2024', 'Speed Demon', 'Focus', 'L', 'розовый', '2024-08-23T21:00:00.000Z', '76864.00', 'в ремонте', 4, '2025-04-30T21:00:00.000Z', 51, 'Настроена передача', '2025-08-17T00:52:11.168Z', '2025-08-17T00:52:11.168Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (70, 'GT Trail Master 2022', 'Blaze', 'GT', '29"', 'серый', '2024-04-10T21:00:00.000Z', '57561.00', 'в прокате', 1, '2025-03-03T22:00:00.000Z', 36, 'Заменены грипсы', '2025-08-17T00:52:11.168Z', '2025-08-17T00:52:11.168Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (71, 'Focus Hybrid Plus 2022', 'X-Trail', 'Focus', 'д24', 'белый', '2023-10-02T21:00:00.000Z', '125816.00', 'в ремонте', 5, '2025-07-26T21:00:00.000Z', 67, 'Заменен переключатель', '2025-08-17T00:52:11.169Z', '2025-08-17T00:52:11.169Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (72, 'Schwinn Road Runner 2024', 'Speed Demon', 'Schwinn', 'XXL', 'розовый', '2024-01-17T22:00:00.000Z', '99689.00', 'бронь', 4, '2025-05-13T21:00:00.000Z', 55, 'Настроена геометрия руля', '2025-08-17T00:52:11.169Z', '2025-08-17T00:52:11.169Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (73, 'Cube Sport 2024', 'Mountain Pro', 'Cube', '26"', 'желтый', '2024-05-11T21:00:00.000Z', '76514.00', 'в наличии', 4, '2025-04-14T21:00:00.000Z', 84, 'Проведена полная диагностика', '2025-08-17T00:52:11.169Z', '2025-08-17T00:52:11.169Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (74, 'Specialized Urban Elite 2020', 'Enduro Beast', 'Specialized', 'д24', 'зеленый', '2024-02-21T22:00:00.000Z', '100130.00', 'в наличии', 4, '2025-07-18T21:00:00.000Z', 88, 'Проверено состояние вилки', '2025-08-17T00:52:11.170Z', '2025-08-17T00:52:11.170Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (75, 'Trek Elite 2021', 'Lightning', 'Trek', '24"', 'красный', '2025-05-13T21:00:00.000Z', '25987.00', 'в ремонте', 1, '2025-02-18T22:00:00.000Z', 49, 'Отрегулирована высота седла', '2025-08-17T00:52:11.171Z', '2025-08-17T00:52:11.171Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (76, 'Bianchi Urban Elite 2018', 'Mountain Pro', 'Bianchi', 'д20', 'черный', '2024-10-02T21:00:00.000Z', '142904.00', 'в наличии', 4, '2025-08-06T21:00:00.000Z', 52, 'Заменена цепь', '2025-08-17T00:52:11.171Z', '2025-08-17T00:52:11.171Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (77, 'Diamondback Hybrid Plus 2018', 'Storm', 'Diamondback', 'д20', 'черный', '2025-05-08T21:00:00.000Z', '153112.00', 'в прокате', 4, '2025-03-01T22:00:00.000Z', 89, 'Проверен и смазан привод', '2025-08-17T00:52:11.172Z', '2025-08-17T00:52:11.172Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (78, 'GT Blaze 2023', 'Explorer', 'GT', 'д20', 'белый', '2025-01-18T22:00:00.000Z', '55431.00', 'в ремонте', 2, '2025-07-02T21:00:00.000Z', 30, 'Настроена подвеска', '2025-08-17T00:52:11.172Z', '2025-08-17T00:52:11.172Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (79, 'Schwinn Thunder 2024', 'Road Runner', 'Schwinn', '27.5"', 'розовый', '2024-04-08T21:00:00.000Z', '100763.00', 'в ремонте', 1, '2025-03-18T22:00:00.000Z', 85, 'Отрегулированы тормоза', '2025-08-17T00:52:11.173Z', '2025-08-17T00:52:11.173Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (80, 'GT Cross Country 2024', 'Enduro Beast', 'GT', 'M', 'фиолетовый', '2025-03-05T22:00:00.000Z', '13829.00', 'в ремонте', 3, '2025-04-12T21:00:00.000Z', 41, 'Заменены тросики', '2025-08-17T00:52:11.173Z', '2025-08-17T00:52:11.173Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (81, 'Mongoose Thunder 2018', 'Blaze', 'Mongoose', '20"', 'оранжевый', '2024-08-07T21:00:00.000Z', '115461.00', 'в ремонте', 2, '2025-04-01T21:00:00.000Z', 55, 'Отрегулирована высота седла', '2025-08-17T00:52:11.174Z', '2025-08-17T00:52:11.174Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (82, 'Focus Explorer 2022', 'Pro', 'Focus', '20"', 'черный', '2023-10-26T21:00:00.000Z', '152075.00', 'бронь', 3, '2025-08-01T21:00:00.000Z', 36, 'Заменены тросики', '2025-08-17T00:52:11.174Z', '2025-08-17T00:52:11.174Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (83, 'KTM Hybrid Plus 2021', 'Elite', 'KTM', 'д24', 'красный', '2024-04-16T21:00:00.000Z', '87966.00', 'требует ремонта', 4, '2025-06-02T21:00:00.000Z', 59, 'Отремонтирован задний переключатель', '2025-08-17T00:52:11.175Z', '2025-08-17T00:52:11.175Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (84, 'Giant Blaze 2023', 'Explorer', 'Giant', 'XS', 'красный', '2023-10-13T21:00:00.000Z', '77873.00', 'в ремонте', 2, '2025-07-16T21:00:00.000Z', 87, 'Плановое ТО пройдено', '2025-08-17T00:52:11.176Z', '2025-08-17T00:52:11.176Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (85, 'Diamondback Hybrid Plus 2021', 'X-Trail', 'Diamondback', 'L', 'фиолетовый', '2025-06-09T21:00:00.000Z', '139367.00', 'бронь', 3, '2025-05-12T21:00:00.000Z', 56, 'Требует замены тормозных колодок', '2025-08-17T00:52:11.176Z', '2025-08-17T00:52:11.176Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (86, 'Diamondback Warrior 2021', 'Adventure', 'Diamondback', 'д20', 'оранжевый', '2024-11-30T22:00:00.000Z', '74040.00', 'в прокате', 4, '2025-07-13T21:00:00.000Z', 39, 'Настроена геометрия руля', '2025-08-17T00:52:11.177Z', '2025-08-17T00:52:11.177Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (87, 'Diamondback Sport 2024', 'Adventure', 'Diamondback', 'M', 'синий', '2025-03-06T22:00:00.000Z', '93122.00', 'в ремонте', 3, '2025-04-29T21:00:00.000Z', 57, 'Смазаны подшипники', '2025-08-17T00:52:11.177Z', '2025-08-17T00:52:11.177Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (88, 'Bianchi Elite 2023', 'Thunder', 'Bianchi', 'д20', 'синий', '2023-10-06T21:00:00.000Z', '39445.00', 'в ремонте', 3, '2025-03-28T22:00:00.000Z', 54, 'Проверена рама на трещины', '2025-08-17T00:52:11.178Z', '2025-08-17T00:52:11.178Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (89, 'Schwinn Lightning 2024', 'Enduro Beast', 'Schwinn', 'M', 'фиолетовый', '2025-01-01T22:00:00.000Z', '85713.00', 'в наличии', 1, '2025-02-21T22:00:00.000Z', 83, 'Проверено состояние вилки', '2025-08-17T00:52:11.178Z', '2025-08-17T00:52:11.178Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (90, 'Specialized Road Runner 2020', 'Mountain Pro', 'Specialized', '29"', 'серый', '2024-04-16T21:00:00.000Z', '21302.00', 'в ремонте', 5, '2025-07-21T21:00:00.000Z', 45, 'Заменена кассета', '2025-08-17T00:52:11.179Z', '2025-08-17T00:52:11.179Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (91, 'Merida Blaze 2022', 'Blaze', 'Merida', 'д24', 'розовый', '2025-03-17T22:00:00.000Z', '48146.00', 'в наличии', 1, '2025-06-22T21:00:00.000Z', 70, 'Отрегулирована высота седла', '2025-08-17T00:52:11.179Z', '2025-08-17T00:52:11.179Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (92, 'Giant Road Runner 2020', 'Warrior', 'Giant', 'XXL', 'зеленый', '2024-01-03T22:00:00.000Z', '158596.00', 'в прокате', 4, '2025-06-03T21:00:00.000Z', 58, 'Настроена геометрия руля', '2025-08-17T00:52:11.180Z', '2025-08-17T00:52:11.180Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (93, 'GT Sport 2019', 'Pro', 'GT', 'L', 'черный', '2025-02-07T22:00:00.000Z', '108351.00', 'в наличии', 4, '2025-03-26T22:00:00.000Z', 43, 'Проверен и смазан привод', '2025-08-17T00:52:11.180Z', '2025-08-17T00:52:11.180Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (94, 'Fuji City Cruiser 2020', 'Lightning', 'Fuji', 'д20', 'красный', '2024-12-04T22:00:00.000Z', '108877.00', 'требует ремонта', 5, '2025-03-24T22:00:00.000Z', 74, 'Заменены грипсы', '2025-08-17T00:52:11.181Z', '2025-08-17T00:52:11.181Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (95, 'Norco Enduro Beast 2021', 'Sport', 'Norco', 'S', 'оранжевый', '2024-07-18T21:00:00.000Z', '15141.00', 'требует ремонта', 5, '2025-06-27T21:00:00.000Z', 33, 'Проверено состояние вилки', '2025-08-17T00:52:11.181Z', '2025-08-17T00:52:11.181Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (96, 'Cannondale Adventure 2022', 'City Cruiser', 'Cannondale', 'XXL', 'розовый', '2025-02-10T22:00:00.000Z', '30150.00', 'в ремонте', 4, '2025-07-12T21:00:00.000Z', 72, 'Настроена передача', '2025-08-17T00:52:11.182Z', '2025-08-17T00:52:11.182Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (97, 'Mongoose City Cruiser 2022', 'Thunder', 'Mongoose', '20"', 'розовый', '2025-03-12T22:00:00.000Z', '34106.00', 'бронь', 2, '2025-06-07T21:00:00.000Z', 85, 'Проведена полная диагностика', '2025-08-17T00:52:11.183Z', '2025-08-17T00:52:11.183Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (98, 'Scott Elite 2022', 'Sport', 'Scott', 'XL', 'фиолетовый', '2024-04-30T21:00:00.000Z', '55525.00', 'в ремонте', 4, '2025-06-06T21:00:00.000Z', 65, 'Смазаны подшипники', '2025-08-17T00:52:11.183Z', '2025-08-17T00:52:11.183Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (99, 'Fuji X-Trail 2021', 'Lightning', 'Fuji', 'XXL', 'серый', '2024-11-25T22:00:00.000Z', '21019.00', 'бронь', 2, '2025-04-11T21:00:00.000Z', 49, 'Настроена система торможения', '2025-08-17T00:52:11.184Z', '2025-08-17T00:52:11.184Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (100, 'Focus Lightning 2020', 'Hybrid Plus', 'Focus', '20"', 'оранжевый', '2024-04-19T21:00:00.000Z', '74932.00', 'в прокате', 2, '2025-07-14T21:00:00.000Z', 43, 'Настроена передача', '2025-08-17T00:52:11.184Z', '2025-08-17T00:52:11.184Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (101, 'Diamondback Adventure 2022', 'Lightning', 'Diamondback', 'XXL', 'красный', '2025-05-12T21:00:00.000Z', '15402.00', 'в наличии', 3, '2025-06-23T21:00:00.000Z', 39, 'Отрегулированы тормоза', '2025-08-17T00:52:11.185Z', '2025-08-17T00:52:11.185Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (102, 'Bulls Mountain Pro 2021', 'Enduro Beast', 'Bulls', 'д20', 'фиолетовый', '2024-12-06T22:00:00.000Z', '137970.00', 'в ремонте', 2, '2025-06-16T21:00:00.000Z', 63, 'Настроена подвеска', '2025-08-17T00:52:11.185Z', '2025-08-17T00:52:11.185Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (103, 'Diamondback Enduro Beast 2024', 'Adventure', 'Diamondback', 'L', 'розовый', '2025-03-12T22:00:00.000Z', '53221.00', 'в ремонте', 3, '2025-06-29T21:00:00.000Z', 33, 'Смазаны подшипники', '2025-08-17T00:52:11.186Z', '2025-08-17T00:52:11.186Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (104, 'Mongoose Road Runner 2020', 'X-Trail', 'Mongoose', 'XL', 'черный', '2024-03-25T22:00:00.000Z', '65034.00', 'в наличии', 4, '2025-03-06T22:00:00.000Z', 71, 'Проверена рама на трещины', '2025-08-17T00:52:11.186Z', '2025-08-17T00:52:11.186Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (105, 'Scott Adventure 2024', 'Elite', 'Scott', 'XL', 'белый', '2024-04-08T21:00:00.000Z', '31919.00', 'в ремонте', 4, '2025-08-11T21:00:00.000Z', 66, 'Требует замены тормозных колодок', '2025-08-17T00:52:11.187Z', '2025-08-17T00:52:11.187Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (106, 'Trek Lightning 2020', 'Explorer', 'Trek', '26"', 'оранжевый', '2024-03-12T22:00:00.000Z', '80468.00', 'требует ремонта', 3, '2025-04-09T21:00:00.000Z', 55, 'Заменен переключатель', '2025-08-17T00:52:11.187Z', '2025-08-17T00:52:11.187Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (107, 'Giant X-Trail 2019', 'Road Runner', 'Giant', '29"', 'серый', '2024-09-19T21:00:00.000Z', '80371.00', 'требует ремонта', 4, '2025-04-08T21:00:00.000Z', 31, 'Проверена рама на трещины', '2025-08-17T00:52:11.188Z', '2025-08-17T00:52:11.188Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (108, 'Giant Lightning 2024', 'Explorer', 'Giant', '27.5"', 'оранжевый', '2025-07-18T21:00:00.000Z', '61837.00', 'бронь', 4, '2025-02-20T22:00:00.000Z', 89, 'Отремонтирован задний переключатель', '2025-08-17T00:52:11.189Z', '2025-08-17T00:52:11.189Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (109, 'GT Adventure 2022', 'Storm', 'GT', '24"', 'зеленый', '2025-04-13T21:00:00.000Z', '139488.00', 'в ремонте', 1, '2025-05-05T21:00:00.000Z', 60, 'Проверено состояние вилки', '2025-08-17T00:52:11.189Z', '2025-08-17T00:52:11.189Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (110, 'Bulls City Cruiser 2020', 'Pro', 'Bulls', 'XXL', 'оранжевый', '2024-10-05T21:00:00.000Z', '108651.00', 'в прокате', 5, '2025-06-25T21:00:00.000Z', 30, 'Плановое ТО пройдено', '2025-08-17T00:52:11.190Z', '2025-08-17T00:52:11.190Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (111, 'Focus Cross Country 2020', 'Sport', 'Focus', 'S', 'черный', '2024-01-11T22:00:00.000Z', '27994.00', 'в прокате', 2, '2025-05-09T21:00:00.000Z', 64, 'Заменена цепь', '2025-08-17T00:52:11.190Z', '2025-08-17T00:52:11.190Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (112, 'Cube Explorer 2024', 'City Cruiser', 'Cube', 'XS', 'зеленый', '2024-08-05T21:00:00.000Z', '77533.00', 'в прокате', 3, '2025-07-27T21:00:00.000Z', 57, 'Проверен и смазан привод', '2025-08-17T00:52:11.191Z', '2025-08-17T00:52:11.191Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (113, 'Norco Thunder 2024', 'Enduro Beast', 'Norco', 'S', 'розовый', '2024-08-18T21:00:00.000Z', '16442.00', 'в наличии', 1, '2025-04-18T21:00:00.000Z', 39, 'Отрегулированы тормоза', '2025-08-17T00:52:11.191Z', '2025-08-17T00:52:11.191Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (114, 'Merida Enduro Beast 2023', 'Explorer', 'Merida', '26"', 'розовый', '2025-04-19T21:00:00.000Z', '133982.00', 'в прокате', 5, '2025-08-14T21:00:00.000Z', 75, 'Проверен и смазан привод', '2025-08-17T00:52:11.192Z', '2025-08-17T00:52:11.192Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (115, 'Bianchi Elite 2024', 'Sport', 'Bianchi', '27.5"', 'белый', '2024-11-22T22:00:00.000Z', '158515.00', 'в наличии', 4, '2025-02-20T22:00:00.000Z', 40, 'Отрегулирована высота седла', '2025-08-17T00:52:11.192Z', '2025-08-17T00:52:11.192Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (116, 'Schwinn Urban Elite 2024', 'Elite', 'Schwinn', '20"', 'оранжевый', '2025-02-02T22:00:00.000Z', '98545.00', 'в прокате', 5, '2025-04-22T21:00:00.000Z', 67, 'Смазаны подшипники', '2025-08-17T00:52:11.193Z', '2025-08-17T00:52:11.193Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (117, 'Trek Urban Elite 2022', 'Cross Country', 'Trek', 'д20', 'розовый', '2024-01-20T22:00:00.000Z', '47804.00', 'бронь', 4, '2025-05-15T21:00:00.000Z', 56, 'Отрегулирована высота седла', '2025-08-17T00:52:11.194Z', '2025-08-17T00:52:11.194Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (118, 'Cannondale City Cruiser 2018', 'Lightning', 'Cannondale', 'XXL', 'желтый', '2024-08-30T21:00:00.000Z', '70521.00', 'в ремонте', 1, '2025-07-04T21:00:00.000Z', 69, 'Настроена передача', '2025-08-17T00:52:11.195Z', '2025-08-17T00:52:11.195Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (119, 'Norco Adventure 2022', 'Pro', 'Norco', 'XS', 'зеленый', '2023-10-16T21:00:00.000Z', '128275.00', 'в наличии', 3, '2025-05-24T21:00:00.000Z', 57, 'Заменена цепь', '2025-08-17T00:52:11.195Z', '2025-08-17T00:52:11.195Z');
INSERT INTO bikes (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) VALUES (120, 'Orbea Pro 2021', 'Road Runner', 'Orbea', '26"', 'фиолетовый', '2023-11-23T22:00:00.000Z', '158449.00', 'в наличии', 4, '2025-06-03T21:00:00.000Z', 85, 'Отрегулированы тормоза', '2025-08-17T00:52:11.196Z', '2025-08-17T00:52:11.196Z');

--
-- Data for table maintenance_events
--

INSERT INTO maintenance_events (id, bike_id, тип_ремонта, статус_ремонта, дата_начала, дата_окончания, ремонт_запланирован_на, примечания, исполнитель, created_at, updated_at, repair_type, priority, estimated_duration, actual_duration, estimated_cost, actual_cost, менеджер_id, исполнитель_id) VALUES (1, 1, 'Тестовый ремонт', 'в ремонте', '2025-08-08T16:23:50.384Z', NULL, '2025-08-07T21:00:00.000Z', 'Тестовое событие ремонта', NULL, '2025-08-08T16:23:50.384Z', '2025-08-08T16:23:50.388Z', 'current', 2, 30, NULL, '0.00', '0.00', NULL, NULL);
INSERT INTO maintenance_events (id, bike_id, тип_ремонта, статус_ремонта, дата_начала, дата_окончания, ремонт_запланирован_на, примечания, исполнитель, created_at, updated_at, repair_type, priority, estimated_duration, actual_duration, estimated_cost, actual_cost, менеджер_id, исполнитель_id) VALUES (13, 13, 'Замена грипс', 'в процессе', '2024-01-22T11:00:00.000Z', NULL, '2024-01-21T22:00:00.000Z', 'Изношены резиновые ручки', 'Пользователь 3', '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z', 'current', 3, 15, NULL, '0.00', '5800.00', NULL, NULL);
INSERT INTO maintenance_events (id, bike_id, тип_ремонта, статус_ремонта, дата_начала, дата_окончания, ремонт_запланирован_на, примечания, исполнитель, created_at, updated_at, repair_type, priority, estimated_duration, actual_duration, estimated_cost, actual_cost, менеджер_id, исполнитель_id) VALUES (2, 1, 'Тестовый ремонт', 'ремонт выполнен', '2025-08-08T16:25:55.889Z', NULL, '2025-08-07T21:00:00.000Z', 'Тестовое событие ремонта', NULL, '2025-08-08T16:25:55.889Z', '2025-08-08T16:25:55.908Z', 'current', 2, 30, 0, '0.00', '31.00', NULL, NULL);
INSERT INTO maintenance_events (id, bike_id, тип_ремонта, статус_ремонта, дата_начала, дата_окончания, ремонт_запланирован_на, примечания, исполнитель, created_at, updated_at, repair_type, priority, estimated_duration, actual_duration, estimated_cost, actual_cost, менеджер_id, исполнитель_id) VALUES (3, 1, 'Тестовый ремонт', 'ремонт выполнен', '2025-08-08T16:26:19.048Z', NULL, '2025-08-07T21:00:00.000Z', 'Тестовое событие ремонта', NULL, '2025-08-08T16:26:19.048Z', '2025-08-08T16:26:19.065Z', 'current', 2, 30, 0, '0.00', '31.00', NULL, NULL);
INSERT INTO maintenance_events (id, bike_id, тип_ремонта, статус_ремонта, дата_начала, дата_окончания, ремонт_запланирован_на, примечания, исполнитель, created_at, updated_at, repair_type, priority, estimated_duration, actual_duration, estimated_cost, actual_cost, менеджер_id, исполнитель_id) VALUES (4, 1, 'еженедельное ТО', 'запланирован', NULL, NULL, '2025-08-14T21:00:00.000Z', 'Автоматически запланированное еженедельное ТО', NULL, '2025-08-08T16:26:19.071Z', '2025-08-08T16:26:19.071Z', 'weekly', 3, 30, NULL, '0.00', '0.00', NULL, NULL);
INSERT INTO maintenance_events (id, bike_id, тип_ремонта, статус_ремонта, дата_начала, дата_окончания, ремонт_запланирован_на, примечания, исполнитель, created_at, updated_at, repair_type, priority, estimated_duration, actual_duration, estimated_cost, actual_cost, менеджер_id, исполнитель_id) VALUES (7, 9, 'Восстановление после аварии', 'запланирован', NULL, NULL, '2024-01-24T22:00:00.000Z', 'Серьезные повреждения рамы', 'Пользователь 3', '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z', 'current', 3, 15, NULL, '0.00', '0.00', NULL, NULL);
INSERT INTO maintenance_events (id, bike_id, тип_ремонта, статус_ремонта, дата_начала, дата_окончания, ремонт_запланирован_на, примечания, исполнитель, created_at, updated_at, repair_type, priority, estimated_duration, actual_duration, estimated_cost, actual_cost, менеджер_id, исполнитель_id) VALUES (8, 14, 'Плановое ТО', 'в процессе', '2024-01-18T12:00:00.000Z', NULL, '2024-01-17T22:00:00.000Z', 'Регулярное обслуживание', 'Пользователь 5', '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z', 'current', 3, 15, NULL, '0.00', '0.00', NULL, NULL);
INSERT INTO maintenance_events (id, bike_id, тип_ремонта, статус_ремонта, дата_начала, дата_окончания, ремонт_запланирован_на, примечания, исполнитель, created_at, updated_at, repair_type, priority, estimated_duration, actual_duration, estimated_cost, actual_cost, менеджер_id, исполнитель_id) VALUES (14, 8, 'Регулировка переключателей', 'завершен', '2024-01-14T14:00:00.000Z', '2024-01-14T15:30:00.000Z', '2024-01-13T22:00:00.000Z', 'Плохое переключение скоростей', 'Пользователь 5', '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z', 'current', 3, 15, NULL, '0.00', '0.00', NULL, NULL);
INSERT INTO maintenance_events (id, bike_id, тип_ремонта, статус_ремонта, дата_начала, дата_окончания, ремонт_запланирован_на, примечания, исполнитель, created_at, updated_at, repair_type, priority, estimated_duration, actual_duration, estimated_cost, actual_cost, менеджер_id, исполнитель_id) VALUES (15, 15, 'Замена тросиков', 'запланирован', NULL, NULL, '2024-01-29T22:00:00.000Z', 'Профилактическая замена', 'Пользователь 3', '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z', 'current', 3, 15, NULL, '0.00', '0.00', NULL, NULL);
INSERT INTO maintenance_events (id, bike_id, тип_ремонта, статус_ремонта, дата_начала, дата_окончания, ремонт_запланирован_на, примечания, исполнитель, created_at, updated_at, repair_type, priority, estimated_duration, actual_duration, estimated_cost, actual_cost, менеджер_id, исполнитель_id) VALUES (5, 3, 'Замена тормозных колодок', 'завершен', '2024-01-15T07:00:00.000Z', '2024-01-15T09:30:00.000Z', '2024-01-14T22:00:00.000Z', 'Плановая замена изношенных колодок', 'Пользователь 3', '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z', 'current', 3, 15, NULL, '0.00', '1700.00', NULL, NULL);
INSERT INTO maintenance_events (id, bike_id, тип_ремонта, статус_ремонта, дата_начала, дата_окончания, ремонт_запланирован_на, примечания, исполнитель, created_at, updated_at, repair_type, priority, estimated_duration, actual_duration, estimated_cost, actual_cost, менеджер_id, исполнитель_id) VALUES (6, 5, 'Ремонт трансмиссии', 'в процессе', '2024-01-20T08:00:00.000Z', NULL, '2024-01-19T22:00:00.000Z', 'Замена цепи и кассеты', 'Пользователь 5', '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z', 'current', 3, 15, NULL, '0.00', '5600.00', NULL, NULL);
INSERT INTO maintenance_events (id, bike_id, тип_ремонта, статус_ремонта, дата_начала, дата_окончания, ремонт_запланирован_на, примечания, исполнитель, created_at, updated_at, repair_type, priority, estimated_duration, actual_duration, estimated_cost, actual_cost, менеджер_id, исполнитель_id) VALUES (9, 2, 'Замена покрышки', 'завершен', '2024-01-10T13:30:00.000Z', '2024-01-10T14:45:00.000Z', '2024-01-09T22:00:00.000Z', 'Прокол переднего колеса', 'Пользователь 3', '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z', 'current', 3, 15, NULL, '0.00', '5150.00', NULL, NULL);
INSERT INTO maintenance_events (id, bike_id, тип_ремонта, статус_ремонта, дата_начала, дата_окончания, ремонт_запланирован_на, примечания, исполнитель, created_at, updated_at, repair_type, priority, estimated_duration, actual_duration, estimated_cost, actual_cost, менеджер_id, исполнитель_id) VALUES (10, 7, 'Настройка тормозов', 'завершен', '2024-01-12T09:00:00.000Z', '2024-01-12T10:15:00.000Z', '2024-01-11T22:00:00.000Z', 'Слабое торможение', 'Пользователь 5', '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z', 'current', 3, 15, NULL, '0.00', '1540.00', NULL, NULL);
INSERT INTO maintenance_events (id, bike_id, тип_ремонта, статус_ремонта, дата_начала, дата_окончания, ремонт_запланирован_на, примечания, исполнитель, created_at, updated_at, repair_type, priority, estimated_duration, actual_duration, estimated_cost, actual_cost, менеджер_id, исполнитель_id) VALUES (11, 11, 'Замена седла', 'запланирован', NULL, NULL, '2024-01-27T22:00:00.000Z', 'Жалобы клиентов на комфорт', 'Пользователь 3', '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z', 'current', 3, 15, NULL, '0.00', '3800.00', NULL, NULL);
INSERT INTO maintenance_events (id, bike_id, тип_ремонта, статус_ремонта, дата_начала, дата_окончания, ремонт_запланирован_на, примечания, исполнитель, created_at, updated_at, repair_type, priority, estimated_duration, actual_duration, estimated_cost, actual_cost, менеджер_id, исполнитель_id) VALUES (12, 4, 'Чистка и смазка', 'завершен', '2024-01-08T07:30:00.000Z', '2024-01-08T08:30:00.000Z', '2024-01-07T22:00:00.000Z', 'Плановое обслуживание', 'Пользователь 5', '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z', 'current', 3, 15, NULL, '0.00', '1950.00', NULL, NULL);
INSERT INTO maintenance_events (id, bike_id, тип_ремонта, статус_ремонта, дата_начала, дата_окончания, ремонт_запланирован_на, примечания, исполнитель, created_at, updated_at, repair_type, priority, estimated_duration, actual_duration, estimated_cost, actual_cost, менеджер_id, исполнитель_id) VALUES (16, 6, 'Установка фонарей', 'завершен', '2024-01-16T08:15:00.000Z', '2024-01-16T09:00:00.000Z', '2024-01-15T22:00:00.000Z', 'Добавление освещения', 'Пользователь 5', '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z', 'current', 3, 15, NULL, '0.00', '7900.00', NULL, NULL);

--
-- Data for table maintenance_parts
--

INSERT INTO maintenance_parts (id, событие_id, part_model_id, использовано, цена_за_шт, notes, created_at) VALUES (1, 2, 1, 2, '15.50', NULL, '2025-08-08T16:25:55.904Z');
INSERT INTO maintenance_parts (id, событие_id, part_model_id, использовано, цена_за_шт, notes, created_at) VALUES (2, 3, 2, 2, '15.50', NULL, '2025-08-08T16:26:19.063Z');
INSERT INTO maintenance_parts (id, событие_id, part_model_id, использовано, цена_за_шт, notes, created_at) VALUES (3, 5, 3, 2, '850.00', 'Замена передних и задних колодок', '2025-08-08T17:18:00.824Z');
INSERT INTO maintenance_parts (id, событие_id, part_model_id, использовано, цена_за_шт, notes, created_at) VALUES (4, 6, 4, 1, '2400.00', 'Установка новой цепи KMC', '2025-08-08T17:18:00.824Z');
INSERT INTO maintenance_parts (id, событие_id, part_model_id, использовано, цена_за_шт, notes, created_at) VALUES (5, 6, 7, 1, '3200.00', 'Замена кассеты', '2025-08-08T17:18:00.824Z');
INSERT INTO maintenance_parts (id, событие_id, part_model_id, использовано, цена_за_шт, notes, created_at) VALUES (6, 9, 5, 1, '4500.00', 'Новая покрышка Continental', '2025-08-08T17:18:00.824Z');
INSERT INTO maintenance_parts (id, событие_id, part_model_id, использовано, цена_за_шт, notes, created_at) VALUES (7, 9, 6, 1, '650.00', 'Новая камера', '2025-08-08T17:18:00.824Z');
INSERT INTO maintenance_parts (id, событие_id, part_model_id, использовано, цена_за_шт, notes, created_at) VALUES (8, 10, 12, 2, '450.00', 'Замена тормозных тросов', '2025-08-08T17:18:00.824Z');
INSERT INTO maintenance_parts (id, событие_id, part_model_id, использовано, цена_за_шт, notes, created_at) VALUES (9, 10, 13, 2, '320.00', 'Новые рубашки тросов', '2025-08-08T17:18:00.824Z');
INSERT INTO maintenance_parts (id, событие_id, part_model_id, использовано, цена_за_шт, notes, created_at) VALUES (10, 11, 10, 1, '3800.00', 'Установка нового седла', '2025-08-08T17:18:00.824Z');
INSERT INTO maintenance_parts (id, событие_id, part_model_id, использовано, цена_за_шт, notes, created_at) VALUES (11, 12, 17, 1, '750.00', 'Смазка цепи', '2025-08-08T17:18:00.824Z');
INSERT INTO maintenance_parts (id, событие_id, part_model_id, использовано, цена_за_шт, notes, created_at) VALUES (12, 12, 18, 1, '1200.00', 'Очистка трансмиссии', '2025-08-08T17:18:00.824Z');
INSERT INTO maintenance_parts (id, событие_id, part_model_id, использовано, цена_за_шт, notes, created_at) VALUES (13, 13, 11, 2, '2900.00', 'Новые грипсы Ergon', '2025-08-08T17:18:00.824Z');
INSERT INTO maintenance_parts (id, событие_id, part_model_id, использовано, цена_за_шт, notes, created_at) VALUES (14, 16, 8, 1, '5800.00', 'Передний фонарь Cateye', '2025-08-08T17:18:00.824Z');
INSERT INTO maintenance_parts (id, событие_id, part_model_id, использовано, цена_за_шт, notes, created_at) VALUES (15, 16, 9, 1, '2100.00', 'Задний фонарь Lezyne', '2025-08-08T17:18:00.824Z');

--
-- Data for table part_models
--

INSERT INTO part_models (id, name, category, brand, model, description, unit_price, supplier, part_number, created_at, updated_at) VALUES (1, 'Тестовая деталь', 'test', NULL, NULL, NULL, '15.50', NULL, NULL, '2025-08-08T16:25:55.902Z', '2025-08-08T16:25:55.902Z');
INSERT INTO part_models (id, name, category, brand, model, description, unit_price, supplier, part_number, created_at, updated_at) VALUES (2, 'Тестовая деталь', 'test', NULL, NULL, NULL, '15.50', NULL, NULL, '2025-08-08T16:26:19.062Z', '2025-08-08T16:26:19.062Z');
INSERT INTO part_models (id, name, category, brand, model, description, unit_price, supplier, part_number, created_at, updated_at) VALUES (3, 'Тормозные колодки Shimano', 'тормоза', 'Shimano', 'BR-M315', 'Дисковые тормозные колодки', '850.00', 'VeloShop', 'Y8FN98010', '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO part_models (id, name, category, brand, model, description, unit_price, supplier, part_number, created_at, updated_at) VALUES (4, 'Цепь KMC X11', 'трансмиссия', 'KMC', 'X11-93', '11-скоростная цепь', '2400.00', 'BikeWorld', 'X11-93-GD', '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO part_models (id, name, category, brand, model, description, unit_price, supplier, part_number, created_at, updated_at) VALUES (5, 'Покрышка Continental', 'колеса', 'Continental', 'Grand Prix 5000', '700x25c шоссейная', '4500.00', 'TireExpress', 'GP5000-70025', '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO part_models (id, name, category, brand, model, description, unit_price, supplier, part_number, created_at, updated_at) VALUES (6, 'Камера Schwalbe 26"', 'колеса', 'Schwalbe', 'SV13', 'Камера 26x1.5-2.4', '650.00', 'VeloShop', 'SV13-26', '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO part_models (id, name, category, brand, model, description, unit_price, supplier, part_number, created_at, updated_at) VALUES (7, 'Звездочки Sram', 'трансмиссия', 'Sram', 'PG-1130', 'Кассета 11-42T', '3200.00', 'BikeWorld', 'PG1130-1142', '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO part_models (id, name, category, brand, model, description, unit_price, supplier, part_number, created_at, updated_at) VALUES (8, 'Фонарь передний Cateye', 'освещение', 'Cateye', 'Volt 800', 'USB перезаряжаемый', '5800.00', 'LightStore', 'HL-EL471RC', '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO part_models (id, name, category, brand, model, description, unit_price, supplier, part_number, created_at, updated_at) VALUES (9, 'Фонарь задний Lezyne', 'освещение', 'Lezyne', 'Strip Drive', 'LED задний фонарь', '2100.00', 'LightStore', 'LZN-STRIP', '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO part_models (id, name, category, brand, model, description, unit_price, supplier, part_number, created_at, updated_at) VALUES (10, 'Седло Selle Royal', 'оборудование', 'Selle Royal', 'Scientia M1', 'Спортивное седло', '3800.00', 'ComfortRide', 'SR-SCI-M1', '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO part_models (id, name, category, brand, model, description, unit_price, supplier, part_number, created_at, updated_at) VALUES (11, 'Грипсы Ergon', 'оборудование', 'Ergon', 'GA2 Fat', 'Анатомические ручки', '2900.00', 'ComfortRide', 'GA2-FAT-L', '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO part_models (id, name, category, brand, model, description, unit_price, supplier, part_number, created_at, updated_at) VALUES (12, 'Тросик тормозной Jagwire', 'тормоза', 'Jagwire', 'Elite Link', 'Нержавеющий трос', '450.00', 'VeloShop', 'JW-ELK-2000', '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO part_models (id, name, category, brand, model, description, unit_price, supplier, part_number, created_at, updated_at) VALUES (13, 'Рубашка тросика Jagwire', 'тормоза', 'Jagwire', 'Elite Link', 'Оплетка троса 5мм', '320.00', 'VeloShop', 'JW-ELK-5MM', '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO part_models (id, name, category, brand, model, description, unit_price, supplier, part_number, created_at, updated_at) VALUES (14, 'Педали Shimano SPD', 'оборудование', 'Shimano', 'PD-M540', 'Контактные педали', '4200.00', 'BikeWorld', 'PD-M540-BK', '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO part_models (id, name, category, brand, model, description, unit_price, supplier, part_number, created_at, updated_at) VALUES (15, 'Ось заднего колеса', 'колеса', 'Novatec', 'D142SB', 'Втулка 142x12 Thru', '2800.00', 'WheelTech', 'D142SB-32H', '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO part_models (id, name, category, brand, model, description, unit_price, supplier, part_number, created_at, updated_at) VALUES (16, 'Спицы DT Swiss', 'колеса', 'DT Swiss', 'Competition', '2.0/1.8/2.0 мм', '85.00', 'WheelTech', 'DT-COMP-264', '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO part_models (id, name, category, brand, model, description, unit_price, supplier, part_number, created_at, updated_at) VALUES (17, 'Смазка цепи Finish Line', 'обслуживание', 'Finish Line', 'Wet Lube', 'Влажная смазка 60мл', '750.00', 'VeloShop', 'FL-WET-60', '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO part_models (id, name, category, brand, model, description, unit_price, supplier, part_number, created_at, updated_at) VALUES (18, 'Обезжириватель Muc-Off', 'обслуживание', 'Muc-Off', 'Degreaser', 'Очиститель 500мл', '1200.00', 'VeloShop', 'MO-DEG-500', '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO part_models (id, name, category, brand, model, description, unit_price, supplier, part_number, created_at, updated_at) VALUES (19, 'Шестигранник Park Tool', 'инструменты', 'Park Tool', 'AWS-10', 'Набор ключей 1.5-10мм', '3500.00', 'ToolMaster', 'PK-AWS10', '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO part_models (id, name, category, brand, model, description, unit_price, supplier, part_number, created_at, updated_at) VALUES (20, 'Насос напольный Topeak', 'инструменты', 'Topeak', 'Joe Blow Sport', 'С манометром до 11 bar', '4800.00', 'ToolMaster', 'TK-JBS', '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');

--
-- Data for table part_stock
--

INSERT INTO part_stock (id, part_model_id, quantity, min_stock, max_stock, warehouse_location, last_updated, notes) VALUES (1, 3, 25, 10, 94, 'Склад запчастей', '2025-08-08T17:18:00.824Z', NULL);
INSERT INTO part_stock (id, part_model_id, quantity, min_stock, max_stock, warehouse_location, last_updated, notes) VALUES (2, 4, 5, 11, 77, 'Мастерская', '2025-08-08T17:18:00.824Z', NULL);
INSERT INTO part_stock (id, part_model_id, quantity, min_stock, max_stock, warehouse_location, last_updated, notes) VALUES (3, 5, 44, 8, 81, 'Мастерская', '2025-08-08T17:18:00.824Z', NULL);
INSERT INTO part_stock (id, part_model_id, quantity, min_stock, max_stock, warehouse_location, last_updated, notes) VALUES (4, 6, 36, 11, 60, 'Склад запчастей', '2025-08-08T17:18:00.824Z', NULL);
INSERT INTO part_stock (id, part_model_id, quantity, min_stock, max_stock, warehouse_location, last_updated, notes) VALUES (5, 7, 9, 10, 87, 'Мастерская', '2025-08-08T17:18:00.824Z', NULL);
INSERT INTO part_stock (id, part_model_id, quantity, min_stock, max_stock, warehouse_location, last_updated, notes) VALUES (6, 8, 44, 4, 96, 'Мастерская', '2025-08-08T17:18:00.824Z', NULL);
INSERT INTO part_stock (id, part_model_id, quantity, min_stock, max_stock, warehouse_location, last_updated, notes) VALUES (7, 9, 33, 8, 93, 'Мастерская', '2025-08-08T17:18:00.824Z', NULL);
INSERT INTO part_stock (id, part_model_id, quantity, min_stock, max_stock, warehouse_location, last_updated, notes) VALUES (8, 10, 14, 5, 95, 'Мастерская', '2025-08-08T17:18:00.824Z', NULL);
INSERT INTO part_stock (id, part_model_id, quantity, min_stock, max_stock, warehouse_location, last_updated, notes) VALUES (9, 11, 23, 3, 77, 'Склад запчастей', '2025-08-08T17:18:00.824Z', NULL);
INSERT INTO part_stock (id, part_model_id, quantity, min_stock, max_stock, warehouse_location, last_updated, notes) VALUES (10, 12, 31, 9, 73, 'Склад запчастей', '2025-08-08T17:18:00.824Z', NULL);
INSERT INTO part_stock (id, part_model_id, quantity, min_stock, max_stock, warehouse_location, last_updated, notes) VALUES (11, 13, 32, 4, 92, 'Склад запчастей', '2025-08-08T17:18:00.824Z', NULL);
INSERT INTO part_stock (id, part_model_id, quantity, min_stock, max_stock, warehouse_location, last_updated, notes) VALUES (12, 14, 28, 7, 60, 'Мастерская', '2025-08-08T17:18:00.824Z', NULL);
INSERT INTO part_stock (id, part_model_id, quantity, min_stock, max_stock, warehouse_location, last_updated, notes) VALUES (13, 15, 36, 2, 93, 'Мастерская', '2025-08-08T17:18:00.824Z', NULL);
INSERT INTO part_stock (id, part_model_id, quantity, min_stock, max_stock, warehouse_location, last_updated, notes) VALUES (14, 16, 47, 7, 80, 'Склад запчастей', '2025-08-08T17:18:00.824Z', NULL);
INSERT INTO part_stock (id, part_model_id, quantity, min_stock, max_stock, warehouse_location, last_updated, notes) VALUES (15, 17, 31, 6, 90, 'Резервный склад', '2025-08-08T17:18:00.824Z', NULL);
INSERT INTO part_stock (id, part_model_id, quantity, min_stock, max_stock, warehouse_location, last_updated, notes) VALUES (16, 18, 43, 5, 61, 'Основной склад', '2025-08-08T17:18:00.824Z', NULL);
INSERT INTO part_stock (id, part_model_id, quantity, min_stock, max_stock, warehouse_location, last_updated, notes) VALUES (17, 19, 22, 9, 96, 'Склад запчастей', '2025-08-08T17:18:00.824Z', NULL);
INSERT INTO part_stock (id, part_model_id, quantity, min_stock, max_stock, warehouse_location, last_updated, notes) VALUES (18, 20, 7, 10, 69, 'Склад запчастей', '2025-08-08T17:18:00.824Z', NULL);

--
-- Data for table purchase_requests
--

INSERT INTO purchase_requests (id, part_model_id, requested_quantity, reason, status, requested_by, requested_at, approved_by, approved_at, notes, urgent) VALUES (1, 3, 20, 'Низкий запас тормозных колодок', 'pending', 3, '2025-08-08T17:18:00.824Z', NULL, NULL, NULL, true);
INSERT INTO purchase_requests (id, part_model_id, requested_quantity, reason, status, requested_by, requested_at, approved_by, approved_at, notes, urgent) VALUES (2, 5, 5, 'Заказ для планового ремонта', 'approved', 2, '2025-08-08T17:18:00.824Z', 7, '2025-08-03T15:09:17.740Z', NULL, false);
INSERT INTO purchase_requests (id, part_model_id, requested_quantity, reason, status, requested_by, requested_at, approved_by, approved_at, notes, urgent) VALUES (3, 8, 3, 'Запрос на новые фонари', 'pending', 4, '2025-08-08T17:18:00.824Z', NULL, NULL, NULL, false);
INSERT INTO purchase_requests (id, part_model_id, requested_quantity, reason, status, requested_by, requested_at, approved_by, approved_at, notes, urgent) VALUES (4, 11, 10, 'Замена изношенных грипс', 'approved', 5, '2025-08-08T17:18:00.824Z', 2, '2025-08-08T11:09:21.273Z', NULL, false);
INSERT INTO purchase_requests (id, part_model_id, requested_quantity, reason, status, requested_by, requested_at, approved_by, approved_at, notes, urgent) VALUES (5, 15, 2, 'Срочный ремонт колеса', 'pending', 3, '2025-08-08T17:18:00.824Z', NULL, NULL, NULL, true);
INSERT INTO purchase_requests (id, part_model_id, requested_quantity, reason, status, requested_by, requested_at, approved_by, approved_at, notes, urgent) VALUES (6, 18, 6, 'Пополнение расходных материалов', 'approved', 6, '2025-08-08T17:18:00.824Z', 7, '2025-08-03T03:15:08.836Z', NULL, false);
INSERT INTO purchase_requests (id, part_model_id, requested_quantity, reason, status, requested_by, requested_at, approved_by, approved_at, notes, urgent) VALUES (7, 10, 4, 'Замена седел на арендных велосипедах', 'pending', 4, '2025-08-08T17:18:00.824Z', NULL, NULL, NULL, false);
INSERT INTO purchase_requests (id, part_model_id, requested_quantity, reason, status, requested_by, requested_at, approved_by, approved_at, notes, urgent) VALUES (8, 17, 12, 'Регулярное обслуживание', 'approved', 3, '2025-08-08T17:18:00.824Z', 2, '2025-08-06T10:06:01.462Z', NULL, false);

--
-- Data for table repair_status_history
--

INSERT INTO repair_status_history (id, repair_id, old_status, new_status, changed_by_id, changed_at, reason, notes, duration_in_previous_status) VALUES (1, 1, 'запланирован', 'в ремонте', NULL, '2025-08-08T16:23:50.388Z', NULL, NULL, 0);
INSERT INTO repair_status_history (id, repair_id, old_status, new_status, changed_by_id, changed_at, reason, notes, duration_in_previous_status) VALUES (2, 2, 'запланирован', 'в ремонте', NULL, '2025-08-08T16:25:55.892Z', NULL, NULL, 0);
INSERT INTO repair_status_history (id, repair_id, old_status, new_status, changed_by_id, changed_at, reason, notes, duration_in_previous_status) VALUES (3, 2, 'в ремонте', 'ремонт выполнен', NULL, '2025-08-08T16:25:55.908Z', NULL, NULL, 0);
INSERT INTO repair_status_history (id, repair_id, old_status, new_status, changed_by_id, changed_at, reason, notes, duration_in_previous_status) VALUES (4, 3, 'запланирован', 'в ремонте', NULL, '2025-08-08T16:26:19.052Z', NULL, NULL, 0);
INSERT INTO repair_status_history (id, repair_id, old_status, new_status, changed_by_id, changed_at, reason, notes, duration_in_previous_status) VALUES (5, 3, 'в ремонте', 'ремонт выполнен', NULL, '2025-08-08T16:26:19.065Z', NULL, NULL, 0);

--
-- Data for table users
--

INSERT INTO users (id, name, email, phone, role, is_active, created_at, updated_at) VALUES (1, 'Test User', 'test@example.com', NULL, 'mechanic', true, '2025-08-08T16:23:50.381Z', '2025-08-08T16:23:50.381Z');
INSERT INTO users (id, name, email, phone, role, is_active, created_at, updated_at) VALUES (2, 'Иванов Сергей Петрович', 'sergey.ivanov@bikerental.ru', '+7-925-123-4567', 'manager', true, '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO users (id, name, email, phone, role, is_active, created_at, updated_at) VALUES (3, 'Петрова Анна Владимировна', 'anna.petrova@bikerental.ru', '+7-916-987-6543', 'mechanic', true, '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO users (id, name, email, phone, role, is_active, created_at, updated_at) VALUES (4, 'Smith John', 'john.smith@bikerental.ru', '+7-903-555-0123', 'employee', true, '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO users (id, name, email, phone, role, is_active, created_at, updated_at) VALUES (5, 'Козлов Михаил Александрович', NULL, '+7-905-777-8899', 'mechanic', true, '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO users (id, name, email, phone, role, is_active, created_at, updated_at) VALUES (6, 'Johnson Sarah', 'sarah.j@bikerental.ru', NULL, 'employee', true, '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO users (id, name, email, phone, role, is_active, created_at, updated_at) VALUES (7, 'Сидоров Алексей Викторович', 'alexey.sidorov@bikerental.ru', '+7-926-444-3333', 'manager', true, '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');
INSERT INTO users (id, name, email, phone, role, is_active, created_at, updated_at) VALUES (8, 'Garcia Maria', NULL, '+7-915-222-1111', 'employee', true, '2025-08-08T17:18:00.824Z', '2025-08-08T17:18:00.824Z');

--
-- Data for table weekly_repair_schedule
--

INSERT INTO weekly_repair_schedule (id, bike_id, day_of_week, week_interval, is_active, last_scheduled, next_scheduled, created_at, created_by_id, updated_at) VALUES (1, 1, 1, 1, true, '2025-08-14T21:00:00.000Z', '2025-08-21T21:00:00.000Z', '2025-08-08T16:25:55.912Z', 1, '2025-08-08T16:26:19.071Z');
INSERT INTO weekly_repair_schedule (id, bike_id, day_of_week, week_interval, is_active, last_scheduled, next_scheduled, created_at, created_by_id, updated_at) VALUES (3, 2, 2, 1, true, NULL, NULL, '2025-08-16T15:30:16.154Z', NULL, '2025-08-16T15:30:16.154Z');
INSERT INTO weekly_repair_schedule (id, bike_id, day_of_week, week_interval, is_active, last_scheduled, next_scheduled, created_at, created_by_id, updated_at) VALUES (4, 3, 2, 1, true, NULL, NULL, '2025-08-16T15:30:30.190Z', NULL, '2025-08-16T15:30:30.190Z');
INSERT INTO weekly_repair_schedule (id, bike_id, day_of_week, week_interval, is_active, last_scheduled, next_scheduled, created_at, created_by_id, updated_at) VALUES (5, 5, 4, 1, true, NULL, NULL, '2025-08-16T15:30:32.756Z', NULL, '2025-08-16T15:30:32.756Z');
INSERT INTO weekly_repair_schedule (id, bike_id, day_of_week, week_interval, is_active, last_scheduled, next_scheduled, created_at, created_by_id, updated_at) VALUES (6, 4, 1, 1, true, NULL, NULL, '2025-08-16T15:30:35.480Z', NULL, '2025-08-16T15:30:35.480Z');

