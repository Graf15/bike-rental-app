--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

-- Started on 2025-09-20 00:13:51

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 4 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- TOC entry 5006 (class 0 OID 0)
-- Dependencies: 4
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- TOC entry 255 (class 1255 OID 16642)
-- Name: generate_weekly_repairs(date); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.generate_weekly_repairs(target_date date DEFAULT NULL::date) RETURNS integer
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.generate_weekly_repairs(target_date date) OWNER TO postgres;

--
-- TOC entry 242 (class 1255 OID 16638)
-- Name: log_repair_status_change(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.log_repair_status_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.log_repair_status_change() OWNER TO postgres;

--
-- TOC entry 243 (class 1255 OID 16640)
-- Name: update_repair_cost(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_repair_cost() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.update_repair_cost() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 232 (class 1259 OID 16602)
-- Name: bike_status_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bike_status_history (
    id integer NOT NULL,
    bike_id integer NOT NULL,
    old_status character varying(50),
    new_status character varying(50) NOT NULL,
    changed_at timestamp without time zone DEFAULT now(),
    reason character varying(100),
    repair_id integer,
    changed_by_id integer,
    duration_in_previous_status integer,
    notes text,
    CONSTRAINT valid_bike_status_change CHECK ((((old_status)::text IS DISTINCT FROM (new_status)::text) OR (old_status IS NULL)))
);


ALTER TABLE public.bike_status_history OWNER TO postgres;

--
-- TOC entry 5007 (class 0 OID 0)
-- Dependencies: 232
-- Name: TABLE bike_status_history; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.bike_status_history IS 'История статусов велосипедов для расчета времени простоев';


--
-- TOC entry 5008 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN bike_status_history.reason; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.bike_status_history.reason IS 'Причина: repair, maintenance, rental, stolen, etc.';


--
-- TOC entry 231 (class 1259 OID 16601)
-- Name: bike_status_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bike_status_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bike_status_history_id_seq OWNER TO postgres;

--
-- TOC entry 5009 (class 0 OID 0)
-- Dependencies: 231
-- Name: bike_status_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bike_status_history_id_seq OWNED BY public.bike_status_history.id;


--
-- TOC entry 239 (class 1259 OID 16682)
-- Name: bikes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bikes (
    id integer NOT NULL,
    model character varying(300) NOT NULL,
    internal_article character varying(100),
    brand_id integer,
    purchase_price_usd numeric(10,2),
    purchase_price_uah numeric(10,2),
    purchase_date date,
    model_year integer,
    wheel_size character varying(20),
    frame_size character varying(20),
    gender character varying(20),
    price_segment character varying(50),
    supplier_article character varying(100),
    supplier_website_link character varying(500),
    photos jsonb DEFAULT '{}'::jsonb,
    last_maintenance_date date,
    condition_status character varying(50),
    notes text,
    has_documents boolean DEFAULT false,
    document_details jsonb DEFAULT '{}'::jsonb,
    installed_components jsonb DEFAULT '{}'::jsonb,
    created_by integer,
    updated_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    frame_number character varying(100)
);


ALTER TABLE public.bikes OWNER TO postgres;

--
-- TOC entry 237 (class 1259 OID 16676)
-- Name: bikes_backup; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bikes_backup (
    id integer,
    name character varying(100),
    model character varying(100),
    brand character varying(50),
    size character varying(10),
    color character varying(30),
    purchase_date date,
    purchase_price numeric(10,2),
    status character varying(50),
    condition_rating integer,
    last_service_date date,
    service_interval_days integer,
    notes text,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


ALTER TABLE public.bikes_backup OWNER TO postgres;

--
-- TOC entry 238 (class 1259 OID 16681)
-- Name: bikes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bikes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bikes_id_seq OWNER TO postgres;

--
-- TOC entry 5010 (class 0 OID 0)
-- Dependencies: 238
-- Name: bikes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bikes_id_seq OWNED BY public.bikes.id;


--
-- TOC entry 234 (class 1259 OID 16654)
-- Name: brands; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.brands (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    country character varying(50),
    website character varying(200),
    description text,
    logo_url character varying(500),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.brands OWNER TO postgres;

--
-- TOC entry 233 (class 1259 OID 16653)
-- Name: brands_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.brands_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.brands_id_seq OWNER TO postgres;

--
-- TOC entry 5011 (class 0 OID 0)
-- Dependencies: 233
-- Name: brands_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.brands_id_seq OWNED BY public.brands.id;


--
-- TOC entry 236 (class 1259 OID 16667)
-- Name: currency_rates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.currency_rates (
    id integer NOT NULL,
    currency_code character varying(3) NOT NULL,
    date date NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    rate_to_uah numeric(10,4)
);


ALTER TABLE public.currency_rates OWNER TO postgres;

--
-- TOC entry 235 (class 1259 OID 16666)
-- Name: currency_rates_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.currency_rates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.currency_rates_id_seq OWNER TO postgres;

--
-- TOC entry 5012 (class 0 OID 0)
-- Dependencies: 235
-- Name: currency_rates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.currency_rates_id_seq OWNED BY public.currency_rates.id;


--
-- TOC entry 241 (class 1259 OID 16741)
-- Name: maintenance_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.maintenance_events (
    id integer NOT NULL,
    bike_id integer,
    maintenance_type character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'planned'::character varying NOT NULL,
    scheduled_at timestamp without time zone,
    scheduled_user_id integer,
    scheduled_for timestamp without time zone,
    scheduled_for_user_id integer,
    started_at timestamp without time zone,
    started_user_id integer,
    completed_at timestamp without time zone,
    completed_user_id integer,
    tested_at timestamp without time zone,
    tested_user_id integer,
    description text,
    notes text,
    parts_need character varying(20) DEFAULT 'not_needed'::character varying,
    parts_needed_at timestamp without time zone,
    parts_ordered_at timestamp without time zone,
    parts_delivered_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT maintenance_events_maintenance_type_check CHECK (((maintenance_type)::text = ANY ((ARRAY['current'::character varying, 'weekly'::character varying, 'longterm'::character varying])::text[]))),
    CONSTRAINT maintenance_events_parts_need_check CHECK (((parts_need)::text = ANY ((ARRAY['not_needed'::character varying, 'needed'::character varying, 'ordered'::character varying, 'delivered'::character varying])::text[]))),
    CONSTRAINT maintenance_events_status_check CHECK (((status)::text = ANY ((ARRAY['planned'::character varying, 'in_progress'::character varying, 'completed'::character varying])::text[])))
);


ALTER TABLE public.maintenance_events OWNER TO postgres;

--
-- TOC entry 240 (class 1259 OID 16740)
-- Name: maintenance_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.maintenance_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.maintenance_events_id_seq OWNER TO postgres;

--
-- TOC entry 5013 (class 0 OID 0)
-- Dependencies: 240
-- Name: maintenance_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.maintenance_events_id_seq OWNED BY public.maintenance_events.id;


--
-- TOC entry 224 (class 1259 OID 16481)
-- Name: maintenance_parts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.maintenance_parts (
    id integer NOT NULL,
    "событие_id" integer NOT NULL,
    part_model_id integer NOT NULL,
    "использовано" integer NOT NULL,
    "цена_за_шт" numeric(10,2) DEFAULT 0,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT "maintenance_parts_использовано_check" CHECK (("использовано" > 0))
);


ALTER TABLE public.maintenance_parts OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 16480)
-- Name: maintenance_parts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.maintenance_parts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.maintenance_parts_id_seq OWNER TO postgres;

--
-- TOC entry 5014 (class 0 OID 0)
-- Dependencies: 223
-- Name: maintenance_parts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.maintenance_parts_id_seq OWNED BY public.maintenance_parts.id;


--
-- TOC entry 220 (class 1259 OID 16433)
-- Name: part_models; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.part_models (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    category character varying(50),
    brand character varying(50),
    model character varying(100),
    description text,
    unit_price numeric(10,2) DEFAULT 0,
    supplier character varying(100),
    part_number character varying(50),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.part_models OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 16432)
-- Name: part_models_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.part_models_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.part_models_id_seq OWNER TO postgres;

--
-- TOC entry 5015 (class 0 OID 0)
-- Dependencies: 219
-- Name: part_models_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.part_models_id_seq OWNED BY public.part_models.id;


--
-- TOC entry 222 (class 1259 OID 16445)
-- Name: part_stock; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.part_stock (
    id integer NOT NULL,
    part_model_id integer NOT NULL,
    quantity integer DEFAULT 0,
    min_stock integer DEFAULT 5,
    max_stock integer DEFAULT 100,
    warehouse_location character varying(50),
    last_updated timestamp without time zone DEFAULT now(),
    notes text,
    CONSTRAINT part_stock_quantity_check CHECK ((quantity >= 0))
);


ALTER TABLE public.part_stock OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 16444)
-- Name: part_stock_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.part_stock_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.part_stock_id_seq OWNER TO postgres;

--
-- TOC entry 5016 (class 0 OID 0)
-- Dependencies: 221
-- Name: part_stock_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.part_stock_id_seq OWNED BY public.part_stock.id;


--
-- TOC entry 226 (class 1259 OID 16503)
-- Name: purchase_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_requests (
    id integer NOT NULL,
    part_model_id integer NOT NULL,
    requested_quantity integer NOT NULL,
    reason character varying(255),
    status character varying(50) DEFAULT 'pending'::character varying,
    requested_by integer,
    requested_at timestamp without time zone DEFAULT now(),
    approved_by integer,
    approved_at timestamp without time zone,
    notes text,
    urgent boolean DEFAULT false,
    CONSTRAINT purchase_requests_requested_quantity_check CHECK ((requested_quantity > 0))
);


ALTER TABLE public.purchase_requests OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 16502)
-- Name: purchase_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.purchase_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.purchase_requests_id_seq OWNER TO postgres;

--
-- TOC entry 5017 (class 0 OID 0)
-- Dependencies: 225
-- Name: purchase_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.purchase_requests_id_seq OWNED BY public.purchase_requests.id;


--
-- TOC entry 230 (class 1259 OID 16581)
-- Name: repair_status_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.repair_status_history (
    id integer NOT NULL,
    repair_id integer NOT NULL,
    old_status character varying(50),
    new_status character varying(50) NOT NULL,
    changed_by_id integer,
    changed_at timestamp without time zone DEFAULT now(),
    reason text,
    notes text,
    duration_in_previous_status integer,
    CONSTRAINT valid_status_change CHECK ((((old_status)::text IS DISTINCT FROM (new_status)::text) OR (old_status IS NULL)))
);


ALTER TABLE public.repair_status_history OWNER TO postgres;

--
-- TOC entry 5018 (class 0 OID 0)
-- Dependencies: 230
-- Name: TABLE repair_status_history; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.repair_status_history IS 'История изменений статусов ремонтов для аудита';


--
-- TOC entry 5019 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN repair_status_history.duration_in_previous_status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.repair_status_history.duration_in_previous_status IS 'Время в предыдущем статусе (минуты)';


--
-- TOC entry 229 (class 1259 OID 16580)
-- Name: repair_status_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.repair_status_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.repair_status_history_id_seq OWNER TO postgres;

--
-- TOC entry 5020 (class 0 OID 0)
-- Dependencies: 229
-- Name: repair_status_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.repair_status_history_id_seq OWNED BY public.repair_status_history.id;


--
-- TOC entry 218 (class 1259 OID 16405)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(255),
    phone character varying(20),
    role character varying(50) DEFAULT 'employee'::character varying,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 217 (class 1259 OID 16404)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 5021 (class 0 OID 0)
-- Dependencies: 217
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 228 (class 1259 OID 16556)
-- Name: weekly_repair_schedule; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.weekly_repair_schedule (
    id integer NOT NULL,
    bike_id integer NOT NULL,
    day_of_week integer NOT NULL,
    week_interval integer DEFAULT 1,
    is_active boolean DEFAULT true,
    last_scheduled date,
    next_scheduled date,
    created_at timestamp without time zone DEFAULT now(),
    created_by_id integer,
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT weekly_repair_schedule_day_of_week_check CHECK (((day_of_week >= 1) AND (day_of_week <= 7))),
    CONSTRAINT weekly_repair_schedule_week_interval_check CHECK ((week_interval > 0))
);


ALTER TABLE public.weekly_repair_schedule OWNER TO postgres;

--
-- TOC entry 5022 (class 0 OID 0)
-- Dependencies: 228
-- Name: TABLE weekly_repair_schedule; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.weekly_repair_schedule IS 'График еженедельного обслуживания велосипедов';


--
-- TOC entry 5023 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN weekly_repair_schedule.day_of_week; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.weekly_repair_schedule.day_of_week IS '1=Понедельник, 7=Воскресенье';


--
-- TOC entry 5024 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN weekly_repair_schedule.week_interval; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.weekly_repair_schedule.week_interval IS 'Интервал в неделях (1=каждую неделю)';


--
-- TOC entry 227 (class 1259 OID 16555)
-- Name: weekly_repair_schedule_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.weekly_repair_schedule_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.weekly_repair_schedule_id_seq OWNER TO postgres;

--
-- TOC entry 5025 (class 0 OID 0)
-- Dependencies: 227
-- Name: weekly_repair_schedule_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.weekly_repair_schedule_id_seq OWNED BY public.weekly_repair_schedule.id;


--
-- TOC entry 4731 (class 2604 OID 16605)
-- Name: bike_status_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bike_status_history ALTER COLUMN id SET DEFAULT nextval('public.bike_status_history_id_seq'::regclass);


--
-- TOC entry 4738 (class 2604 OID 16685)
-- Name: bikes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bikes ALTER COLUMN id SET DEFAULT nextval('public.bikes_id_seq'::regclass);


--
-- TOC entry 4733 (class 2604 OID 16657)
-- Name: brands id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brands ALTER COLUMN id SET DEFAULT nextval('public.brands_id_seq'::regclass);


--
-- TOC entry 4736 (class 2604 OID 16670)
-- Name: currency_rates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.currency_rates ALTER COLUMN id SET DEFAULT nextval('public.currency_rates_id_seq'::regclass);


--
-- TOC entry 4745 (class 2604 OID 16744)
-- Name: maintenance_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maintenance_events ALTER COLUMN id SET DEFAULT nextval('public.maintenance_events_id_seq'::regclass);


--
-- TOC entry 4717 (class 2604 OID 16484)
-- Name: maintenance_parts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maintenance_parts ALTER COLUMN id SET DEFAULT nextval('public.maintenance_parts_id_seq'::regclass);


--
-- TOC entry 4708 (class 2604 OID 16436)
-- Name: part_models id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.part_models ALTER COLUMN id SET DEFAULT nextval('public.part_models_id_seq'::regclass);


--
-- TOC entry 4712 (class 2604 OID 16448)
-- Name: part_stock id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.part_stock ALTER COLUMN id SET DEFAULT nextval('public.part_stock_id_seq'::regclass);


--
-- TOC entry 4720 (class 2604 OID 16506)
-- Name: purchase_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_requests ALTER COLUMN id SET DEFAULT nextval('public.purchase_requests_id_seq'::regclass);


--
-- TOC entry 4729 (class 2604 OID 16584)
-- Name: repair_status_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_status_history ALTER COLUMN id SET DEFAULT nextval('public.repair_status_history_id_seq'::regclass);


--
-- TOC entry 4703 (class 2604 OID 16408)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 4724 (class 2604 OID 16559)
-- Name: weekly_repair_schedule id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.weekly_repair_schedule ALTER COLUMN id SET DEFAULT nextval('public.weekly_repair_schedule_id_seq'::regclass);


--
-- TOC entry 4991 (class 0 OID 16602)
-- Dependencies: 232
-- Data for Name: bike_status_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bike_status_history (id, bike_id, old_status, new_status, changed_at, reason, repair_id, changed_by_id, duration_in_previous_status, notes) FROM stdin;
\.


--
-- TOC entry 4998 (class 0 OID 16682)
-- Dependencies: 239
-- Data for Name: bikes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bikes (id, model, internal_article, brand_id, purchase_price_usd, purchase_price_uah, purchase_date, model_year, wheel_size, frame_size, gender, price_segment, supplier_article, supplier_website_link, photos, last_maintenance_date, condition_status, notes, has_documents, document_details, installed_components, created_by, updated_by, created_at, updated_at, frame_number) FROM stdin;
1	Trek X-Caliber 8	TRK-XC8-2023-001	1	1200.00	44400.00	2023-03-15	2023	29	L	мужской	premium	TRK-XC8-BLK-L	https://www.trekbikes.com/x-caliber-8	{"main": "trek_xc8_main.jpg", "gallery": ["trek_xc8_1.jpg", "trek_xc8_2.jpg"]}	2024-01-15	в наличии	Новый велосипед, прошел предпродажную подготовку	t	{"invoice_date": "2023-03-15", "invoice_photo": "invoice_001.jpg", "invoice_price_uah": 44400}	{"fork": "RockShox Judy Silver TK", "brakes": "Shimano MT200", "drivetrain": "Shimano Deore"}	1	\N	2025-08-22 23:06:36.568857	2025-08-22 23:06:36.568857	TRK2023XC8L001
2	Specialized Rockhopper Sport	SPZ-RH-2022-002	2	650.00	24050.00	2022-07-20	2022	27.5	M	унисекс	standart	SPZ-RH-RED-M	https://www.specialized.com/rockhopper-sport	{"main": "spz_rh_main.jpg"}	2023-12-10	в наличии	Регулярное ТО, небольшие царапины на раме	t	{"invoice_date": "2022-07-20", "invoice_price_uah": 24050}	{"fork": "SR Suntour XCT", "brakes": "Tektro", "drivetrain": "Shimano Altus"}	1	\N	2025-08-22 23:06:36.580142	2025-08-22 23:06:36.580142	SPZ2022RHM002
3	Giant Talon 3	GNT-T3-2023-003	3	520.00	19240.00	2023-05-12	2023	26	S	женский	econom	GNT-T3-WHT-S	https://www.giant-bicycles.com/talon-3	{"main": "giant_t3_main.jpg", "detail": "giant_t3_detail.jpg"}	2024-02-01	в прокате	Требует замены тормозных колодок	f	{}	{"fork": "SR Suntour XCE", "brakes": "V-brake", "drivetrain": "Shimano Tourney"}	1	\N	2025-08-22 23:06:36.582179	2025-08-22 23:06:36.582179	GNT2023T3S003
4	Cannondale Trail 8	CND-TR8-2024-004	4	890.00	32930.00	2024-01-08	2024	29	XL	мужской	standart	CND-TR8-GRN-XL	https://www.cannondale.com/trail-8	{"main": "cannondale_tr8.jpg"}	2024-01-20	в наличии	Новинка 2024 года, топовая комплектация	t	{"warranty": "2 года", "invoice_date": "2024-01-08", "invoice_price_uah": 32930}	{"fork": "SR Suntour XCR", "brakes": "Shimano MT200", "drivetrain": "Shimano Acera"}	1	\N	2025-08-22 23:06:36.583354	2025-08-22 23:06:36.583354	CND2024TR8XL004
5	Scott Aspect 960	SCT-A960-2023-005	5	750.00	27750.00	2023-09-14	2023	27.5	M	унисекс	standart	SCT-A960-BLU-M	https://www.scott-sports.com/aspect-960	{"main": "scott_a960.jpg", "side": "scott_a960_side.jpg"}	2023-11-25	в прокате	Легкие следы эксплуатации, все компоненты исправны	t	{"supplier": "Scott Ukraine", "invoice_date": "2023-09-14", "invoice_price_uah": 27750}	{"fork": "SR Suntour XCT", "brakes": "Shimano MT200", "drivetrain": "Shimano Altus"}	1	\N	2025-08-22 23:06:36.584638	2025-08-22 23:06:36.584638	SCT2023A960M005
6	Trek FX 2 Disc	TRK-FX2D-2022-006	1	580.00	21460.00	2022-11-03	2022	26	S	женский	econom	TRK-FX2D-PNK-S	https://www.trekbikes.com/fx-2-disc	{"main": "trek_fx2d.jpg"}	2023-10-15	в ремонте	Нужна замена цепи и кассеты, проблемы с задним переключателем	t	{"invoice_date": "2022-11-03", "invoice_price_uah": 21460}	{"fork": "жесткая", "brakes": "Tektro HD-R280", "drivetrain": "Shimano Altus"}	1	\N	2025-08-22 23:06:36.586297	2025-08-22 23:06:36.586297	TRK2022FX2DS006
7	Giant ATX 2	GNT-ATX2-2023-007	3	480.00	17760.00	2023-06-28	2023	26	M	мужской	econom	GNT-ATX2-BLK-M	https://www.giant-bicycles.com/atx-2	{"main": "giant_atx2.jpg", "components": "giant_atx2_components.jpg"}	2024-01-12	в ремонте	В процессе капитального ремонта, замена всех расходников	f	{"repair_start": "2024-01-10", "expected_completion": "2024-01-20"}	{"fork": "SR Suntour XCT", "brakes": "V-brake", "drivetrain": "Shimano Tourney"}	1	\N	2025-08-22 23:06:36.587737	2025-08-22 23:06:36.587737	GNT2023ATX2M007
8	Specialized Sirrus X 2.0	SPZ-SX2-2024-008	2	1450.00	53650.00	2024-02-14	2024	27.5	L	унисекс	premium	SPZ-SX2-GRY-L	https://www.specialized.com/sirrus-x-2	{"main": "spz_sx2.jpg", "detail1": "spz_sx2_fork.jpg", "detail2": "spz_sx2_drivetrain.jpg"}	2024-02-20	в наличии	Премиум гибрид, только из салона	t	{"warranty": "3 года", "invoice_date": "2024-02-14", "warranty_card": "warranty_008.pdf", "invoice_price_uah": 53650}	{"fork": "Future Shock 1.5", "tires": "Specialized Pathfinder Pro", "brakes": "Shimano MT200", "drivetrain": "Shimano Deore"}	1	\N	2025-08-22 23:06:36.588834	2025-08-22 23:06:36.588834	SPZ2024SX2L008
9	Cannondale Quick CX 3	CND-QCX3-2023-009	4	920.00	34040.00	2023-08-07	2023	27.5	M	женский	premium	CND-QCX3-TRQ-M	https://www.cannondale.com/quick-cx-3	{"main": "cnd_qcx3.jpg"}	2023-12-18	бронь	Отличный городской велосипед, минимальный пробег	t	{"invoice_date": "2023-08-07", "invoice_price_uah": 34040}	{"fork": "Cannondale C3", "brakes": "Tektro HD-R280", "drivetrain": "Shimano Altus"}	1	\N	2025-08-22 23:06:36.591605	2025-08-22 23:06:36.591605	CND2023QCX3M009
10	Scott Sub Cross 20	SCT-SC20-2022-010	5	1680.00	62160.00	2022-04-22	2022	29	XL	мужской	premium	SCT-SC20-MAT-XL	https://www.scott-sports.com/sub-cross-20	{"main": "scott_sc20.jpg", "detail": "scott_sc20_detail.jpg"}	2023-09-05	продан	Серьезные повреждения рамы после аварии, списан	t	{"invoice_date": "2022-04-22", "insurance_claim": "claim_010.pdf", "invoice_price_uah": 62160}	{"fork": "поврежден", "brakes": "Shimano MT400", "drivetrain": "Shimano Deore XT"}	1	\N	2025-08-22 23:06:36.593123	2025-08-22 23:06:36.593123	SCT2022SC20XL010
11	тестовый пидор хуй мутант	хуертикул	\N	356.00	\N	2025-09-05	2020	26	17,5	унисекс	standart			{}	\N	в наличии		f	{}	{}	\N	\N	2025-09-01 19:43:58.832444	2025-09-01 19:43:58.832444	652165256256
12	тест фото		\N	\N	\N	2025-09-12	\N							{"main": 0, "urls": ["https://velotrade.com.ua/assets/images/products/220153/elb-fr-28-022.jpg", "https://velotrade.com.ua/assets/images/products/220153/elb-fr-28-023-2.jpg"]}	\N	в наличии		f	{}	{}	\N	\N	2025-09-12 04:11:48.102765	2025-09-12 04:11:48.102765	
18	тест документы (просто есть)	\N	\N	\N	\N	2025-09-12	\N							{"main": 0, "urls": []}	\N	в наличии		t	{"documents": [], "invoice_date": "", "invoice_price_uah": ""}	{}	\N	\N	2025-09-12 04:55:12.102222	2025-09-12 04:55:12.102222	
19	тест документы (с фото и т.д.)	\N	\N	\N	\N	2025-09-12	\N							{"main": 0, "urls": []}	\N	в наличии		t	{"documents": [{"url": "https://www.ukrstrahovanie.com.ua/wp-content/uploads/2018/07/y.png", "type": "invoice", "description": "шото на велотрейдском"}], "invoice_date": "2025-09-10", "invoice_price_uah": "1520"}	{}	\N	\N	2025-09-12 04:56:53.801133	2025-09-12 04:56:53.801133	
\.


--
-- TOC entry 4996 (class 0 OID 16676)
-- Dependencies: 237
-- Data for Name: bikes_backup; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bikes_backup (id, name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating, last_service_date, service_interval_days, notes, created_at, updated_at) FROM stdin;
3	Giant Road Racer	Defy Advanced 2	Giant	L	Черный	2023-01-20	120000.00	в прокате	4	\N	30	\N	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
7	Scott Mountain Pro	Aspect 940	Scott	L	Оранжевый	2022-12-05	82000.00	в прокате	5	\N	30	\N	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
11	Bianchi Classic	C-Sport 1	Bianchi	M	Белый	2023-01-08	92000.00	в прокате	4	\N	30	\N	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
16	Felt Speed	Verza Speed 40	Felt	S	Красный	2023-02-20	72000.00	в прокате	5	\N	30	\N	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
1	Test Bike	Test Model	\N	\N	\N	2025-08-08	\N	в наличии	5	2025-08-08	30	\N	2025-08-08 19:23:50.379328	2025-08-08 19:23:50.379328
2	Trek Mountain Explorer	X-Caliber 8	Trek	M	Синий	2023-03-15	85000.00	в наличии	5	\N	30	\N	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
4	Specialized City Cruiser	Sirrus X 3.0	Specialized	S	Красный	2022-11-10	95000.00	в наличии	5	\N	30	\N	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
5	Merida All-Terrain	Big.Nine 500	Merida	XL	Зеленый	2023-05-08	75000.00	в ремонте	3	\N	30	\N	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
6	Cannondale Urban	Quick CX 3	Cannondale	M	Белый	2023-02-14	68000.00	в наличии	4	\N	30	\N	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
8	Cube Hybrid	Nature Hybrid One	Cube	M	Серый	2023-04-22	105000.00	в наличии	4	\N	30	\N	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
9	GT Urban Rider	Transeo Comp	GT	S	Синий	2022-10-18	55000.00	в ремонте	2	\N	30	\N	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
10	KTM Adventure	Chicago Disc 291	KTM	L	Черный	2023-06-12	78000.00	в наличии	5	\N	30	\N	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
12	Stels Navigator	Navigator 600 MD	Stels	XL	Зеленый	2022-09-25	35000.00	в наличии	3	\N	30	\N	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
13	Forward City Bike	Barcelona 2.0	Forward	S	Розовый	2023-03-30	28000.00	в наличии	5	\N	30	\N	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
14	Kona Trail	Process 134	Kona	L	Оранжевый	2023-07-01	140000.00	в ремонте	4	\N	30	\N	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
15	Norco Endurance	Search XR C2	Norco	M	Серый	2022-11-28	115000.00	в наличии	4	\N	30	\N	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
17	Trek Thunder 2018	Road Runner	Trek	XXL	черный	2024-06-28	46978.00	в прокате	5	2025-03-06	79	Заменены грипсы	2025-08-17 03:52:11.126121	2025-08-17 03:52:11.126121
18	Orbea Thunder 2021	Cross Country	Orbea	27.5"	фиолетовый	2025-01-11	61712.00	в прокате	4	2025-06-24	35	Заменена цепь	2025-08-17 03:52:11.137502	2025-08-17 03:52:11.137502
19	Schwinn Storm 2019	Adventure	Schwinn	XL	красный	2025-04-15	46781.00	в наличии	4	2025-02-18	78	Смазаны подшипники	2025-08-17 03:52:11.1385	2025-08-17 03:52:11.1385
20	Bianchi Lightning 2018	Cross Country	Bianchi	д24	розовый	2024-12-20	55292.00	в ремонте	3	2025-08-08	87	Отрегулированы тормоза	2025-08-17 03:52:11.139188	2025-08-17 03:52:11.139188
21	Norco Urban Elite 2019	Mountain Pro	Norco	XXL	белый	2024-09-18	138322.00	требует ремонта	2	2025-06-23	49	Заменены покрышки	2025-08-17 03:52:11.14021	2025-08-17 03:52:11.14021
22	Orbea Urban Elite 2018	Blaze	Orbea	д20	серый	2024-03-29	13332.00	в наличии	4	2025-08-02	60	Заменены тросики	2025-08-17 03:52:11.140888	2025-08-17 03:52:11.140888
23	Orbea Mountain Pro 2020	Enduro Beast	Orbea	XS	синий	2024-06-30	17404.00	требует ремонта	2	2025-08-01	43	Отремонтирован задний переключатель	2025-08-17 03:52:11.141718	2025-08-17 03:52:11.141718
24	Cannondale X-Trail 2023	Warrior	Cannondale	26"	оранжевый	2025-03-03	126497.00	бронь	3	2025-05-08	47	Заменен переключатель	2025-08-17 03:52:11.142397	2025-08-17 03:52:11.142397
25	Bulls Sport 2024	Urban Elite	Bulls	д24	красный	2024-04-20	158481.00	в наличии	1	2025-03-17	60	Проверено состояние вилки	2025-08-17 03:52:11.143247	2025-08-17 03:52:11.143247
26	Norco Adventure 2024	Blaze	Norco	S	красный	2023-11-07	122851.00	бронь	5	2025-03-17	83	Плановое ТО пройдено	2025-08-17 03:52:11.144148	2025-08-17 03:52:11.144148
27	Santa Cruz Thunder 2018	Mountain Pro	Santa Cruz	20"	серый	2024-04-02	55275.00	в ремонте	4	2025-07-31	44	Отрегулирована высота седла	2025-08-17 03:52:11.144818	2025-08-17 03:52:11.144818
28	Canyon Speed Demon 2023	Cross Country	Canyon	20"	серый	2025-07-01	19101.00	в наличии	4	2025-08-04	47	Отрегулирована высота седла	2025-08-17 03:52:11.145413	2025-08-17 03:52:11.145413
29	Bulls Sport 2020	Road Runner	Bulls	д24	зеленый	2025-02-06	157725.00	в ремонте	5	2025-07-31	74	Смазаны подшипники	2025-08-17 03:52:11.145956	2025-08-17 03:52:11.145956
30	Merida Adventure 2018	Storm	Merida	д20	черный	2025-06-19	97009.00	в прокате	5	2025-03-18	41	Плановое ТО пройдено	2025-08-17 03:52:11.146589	2025-08-17 03:52:11.146589
31	Scott Warrior 2019	Pro	Scott	XL	оранжевый	2024-06-12	121904.00	в ремонте	3	2025-03-17	67	Проверено состояние вилки	2025-08-17 03:52:11.147229	2025-08-17 03:52:11.147229
32	Specialized Storm 2021	Cross Country	Specialized	29"	оранжевый	2024-02-08	60286.00	требует ремонта	1	2025-07-17	70	Требует замены тормозных колодок	2025-08-17 03:52:11.147907	2025-08-17 03:52:11.147907
33	Bianchi Enduro Beast 2023	Blaze	Bianchi	д24	белый	2025-07-16	104359.00	в наличии	5	2025-07-05	65	Настроена подвеска	2025-08-17 03:52:11.148589	2025-08-17 03:52:11.148589
34	Giant Pro 2021	Pro	Giant	26"	желтый	2024-07-22	153833.00	бронь	1	2025-03-02	41	Отрегулирована высота седла	2025-08-17 03:52:11.149109	2025-08-17 03:52:11.149109
35	Norco Mountain Pro 2024	Elite	Norco	д24	синий	2025-04-21	155143.00	в ремонте	5	2025-06-29	43	Заменена кассета	2025-08-17 03:52:11.149636	2025-08-17 03:52:11.149636
36	Focus X-Trail 2019	Enduro Beast	Focus	27.5"	розовый	2024-01-17	28901.00	в ремонте	2	2025-03-13	49	Отрегулированы тормоза	2025-08-17 03:52:11.150161	2025-08-17 03:52:11.150161
37	Orbea Enduro Beast 2020	Road Runner	Orbea	S	желтый	2023-12-12	46606.00	в наличии	4	2025-03-05	60	Отремонтирован задний переключатель	2025-08-17 03:52:11.150819	2025-08-17 03:52:11.150819
38	GT Thunder 2022	Enduro Beast	GT	26"	черный	2025-07-24	27970.00	требует ремонта	2	2025-03-24	75	Плановое ТО пройдено	2025-08-17 03:52:11.151335	2025-08-17 03:52:11.151335
39	Schwinn Explorer 2018	Road Runner	Schwinn	XS	желтый	2025-02-14	44858.00	бронь	4	2025-07-23	33	Заменены покрышки	2025-08-17 03:52:11.151848	2025-08-17 03:52:11.151848
40	Orbea Hybrid Plus 2024	Cross Country	Orbea	д24	зеленый	2025-03-16	151312.00	в прокате	5	2025-05-30	85	Отрегулированы тормоза	2025-08-17 03:52:11.152297	2025-08-17 03:52:11.152297
41	Specialized Urban Elite 2020	Lightning	Specialized	20"	синий	2025-04-16	127840.00	требует ремонта	4	2025-04-16	53	Плановое ТО пройдено	2025-08-17 03:52:11.152727	2025-08-17 03:52:11.152727
42	Fuji Thunder 2020	X-Trail	Fuji	M	красный	2025-03-28	61300.00	требует ремонта	3	2025-05-20	42	Настроена передача	2025-08-17 03:52:11.153153	2025-08-17 03:52:11.153153
43	Merida Blaze 2020	City Cruiser	Merida	XL	белый	2025-05-27	100287.00	бронь	5	2025-06-04	46	Заменены покрышки	2025-08-17 03:52:11.15358	2025-08-17 03:52:11.15358
44	Scott Speed Demon 2021	Mountain Pro	Scott	XXL	желтый	2025-08-14	115159.00	в наличии	2	2025-08-07	84	Проведена полная диагностика	2025-08-17 03:52:11.155815	2025-08-17 03:52:11.155815
45	Specialized Warrior 2021	Speed Demon	Specialized	29"	желтый	2025-03-16	55563.00	в ремонте	3	2025-02-19	63	Проверен и смазан привод	2025-08-17 03:52:11.156272	2025-08-17 03:52:11.156272
46	Schwinn Warrior 2024	Enduro Beast	Schwinn	XS	серый	2024-09-20	84437.00	в наличии	4	2025-07-22	36	Проведена полная диагностика	2025-08-17 03:52:11.156728	2025-08-17 03:52:11.156728
47	KTM Speed Demon 2022	Adventure	KTM	д20	белый	2024-06-25	51309.00	в прокате	4	2025-06-22	63	Проверено состояние вилки	2025-08-17 03:52:11.157284	2025-08-17 03:52:11.157284
48	Bulls Blaze 2024	Elite	Bulls	S	красный	2024-04-13	19867.00	в ремонте	3	2025-07-19	77	Плановое ТО пройдено	2025-08-17 03:52:11.157935	2025-08-17 03:52:11.157935
49	Mongoose Pro 2024	Trail Master	Mongoose	M	белый	2024-11-07	86776.00	в ремонте	3	2025-08-11	70	Проверена рама на трещины	2025-08-17 03:52:11.158433	2025-08-17 03:52:11.158433
50	Fuji Lightning 2024	Enduro Beast	Fuji	27.5"	желтый	2024-07-05	14951.00	требует ремонта	3	2025-05-23	50	Проверен и смазан привод	2025-08-17 03:52:11.158901	2025-08-17 03:52:11.158901
51	Orbea Lightning 2021	Thunder	Orbea	29"	белый	2025-05-20	148866.00	в прокате	3	2025-07-09	68	Заменена цепь	2025-08-17 03:52:11.159336	2025-08-17 03:52:11.159336
52	Schwinn Mountain Pro 2024	Enduro Beast	Schwinn	XS	красный	2024-02-27	97239.00	в прокате	1	2025-03-11	43	Настроена подвеска	2025-08-17 03:52:11.159817	2025-08-17 03:52:11.159817
53	Fuji Speed Demon 2020	Enduro Beast	Fuji	M	красный	2024-03-16	45833.00	требует ремонта	4	2025-02-25	63	Настроена передача	2025-08-17 03:52:11.160246	2025-08-17 03:52:11.160246
54	Diamondback Explorer 2023	Trail Master	Diamondback	24"	розовый	2024-12-21	98541.00	в ремонте	1	2025-06-12	85	Заменены покрышки	2025-08-17 03:52:11.160695	2025-08-17 03:52:11.160695
55	Scott Lightning 2019	Urban Elite	Scott	29"	желтый	2024-11-13	84491.00	в наличии	5	2025-06-28	71	Заменен переключатель	2025-08-17 03:52:11.161124	2025-08-17 03:52:11.161124
56	Cannondale Storm 2022	Blaze	Cannondale	XS	зеленый	2023-12-12	132092.00	в ремонте	3	2025-05-05	33	Отремонтирован задний переключатель	2025-08-17 03:52:11.161534	2025-08-17 03:52:11.161534
57	Canyon Sport 2022	Elite	Canyon	29"	красный	2023-11-02	150736.00	бронь	1	2025-03-18	33	Заменена цепь	2025-08-17 03:52:11.162062	2025-08-17 03:52:11.162062
58	Scott Thunder 2022	Speed Demon	Scott	д24	оранжевый	2024-01-14	112059.00	в наличии	3	2025-07-06	56	Проверено состояние вилки	2025-08-17 03:52:11.162677	2025-08-17 03:52:11.162677
59	Bulls Elite 2022	City Cruiser	Bulls	26"	фиолетовый	2024-02-18	52293.00	в наличии	4	2025-07-30	40	Заменены покрышки	2025-08-17 03:52:11.163217	2025-08-17 03:52:11.163217
60	Diamondback Lightning 2024	Explorer	Diamondback	26"	серый	2025-02-03	53505.00	бронь	1	2025-03-09	52	Отремонтирован задний переключатель	2025-08-17 03:52:11.16376	2025-08-17 03:52:11.16376
61	Specialized X-Trail 2020	Warrior	Specialized	д20	черный	2024-01-10	96126.00	в ремонте	1	2025-08-03	53	Настроена передача	2025-08-17 03:52:11.164296	2025-08-17 03:52:11.164296
62	Cannondale Thunder 2023	Blaze	Cannondale	XXL	фиолетовый	2024-09-10	11050.00	требует ремонта	1	2025-04-24	67	Проверено состояние вилки	2025-08-17 03:52:11.164825	2025-08-17 03:52:11.164825
63	Trek Storm 2023	City Cruiser	Trek	24"	синий	2024-10-15	133335.00	в наличии	5	2025-07-08	65	Отремонтирован задний переключатель	2025-08-17 03:52:11.165275	2025-08-17 03:52:11.165275
64	Diamondback Blaze 2023	Mountain Pro	Diamondback	д20	фиолетовый	2024-08-04	11543.00	в наличии	3	2025-03-21	48	Настроена подвеска	2025-08-17 03:52:11.165739	2025-08-17 03:52:11.165739
65	GT Cross Country 2021	Warrior	GT	д24	черный	2024-09-14	116088.00	в ремонте	1	2025-07-26	48	Отремонтирован задний переключатель	2025-08-17 03:52:11.166188	2025-08-17 03:52:11.166188
66	Diamondback Sport 2021	Enduro Beast	Diamondback	д20	желтый	2025-05-25	145194.00	в наличии	4	2025-08-07	75	Настроена геометрия руля	2025-08-17 03:52:11.166636	2025-08-17 03:52:11.166636
67	Bulls Storm 2021	Storm	Bulls	XL	оранжевый	2024-08-13	41877.00	требует ремонта	2	2025-02-28	75	Отрегулирована высота седла	2025-08-17 03:52:11.167071	2025-08-17 03:52:11.167071
68	Merida Pro 2024	Thunder	Merida	д24	белый	2024-08-12	93233.00	требует ремонта	4	2025-02-18	46	Отремонтирован задний переключатель	2025-08-17 03:52:11.167542	2025-08-17 03:52:11.167542
69	Focus Road Runner 2024	Speed Demon	Focus	L	розовый	2024-08-24	76864.00	в ремонте	4	2025-05-01	51	Настроена передача	2025-08-17 03:52:11.168087	2025-08-17 03:52:11.168087
70	GT Trail Master 2022	Blaze	GT	29"	серый	2024-04-11	57561.00	в прокате	1	2025-03-04	36	Заменены грипсы	2025-08-17 03:52:11.16859	2025-08-17 03:52:11.16859
71	Focus Hybrid Plus 2022	X-Trail	Focus	д24	белый	2023-10-03	125816.00	в ремонте	5	2025-07-27	67	Заменен переключатель	2025-08-17 03:52:11.169053	2025-08-17 03:52:11.169053
72	Schwinn Road Runner 2024	Speed Demon	Schwinn	XXL	розовый	2024-01-18	99689.00	бронь	4	2025-05-14	55	Настроена геометрия руля	2025-08-17 03:52:11.1695	2025-08-17 03:52:11.1695
73	Cube Sport 2024	Mountain Pro	Cube	26"	желтый	2024-05-12	76514.00	в наличии	4	2025-04-15	84	Проведена полная диагностика	2025-08-17 03:52:11.16997	2025-08-17 03:52:11.16997
74	Specialized Urban Elite 2020	Enduro Beast	Specialized	д24	зеленый	2024-02-22	100130.00	в наличии	4	2025-07-19	88	Проверено состояние вилки	2025-08-17 03:52:11.170539	2025-08-17 03:52:11.170539
75	Trek Elite 2021	Lightning	Trek	24"	красный	2025-05-14	25987.00	в ремонте	1	2025-02-19	49	Отрегулирована высота седла	2025-08-17 03:52:11.171062	2025-08-17 03:52:11.171062
76	Bianchi Urban Elite 2018	Mountain Pro	Bianchi	д20	черный	2024-10-03	142904.00	в наличии	4	2025-08-07	52	Заменена цепь	2025-08-17 03:52:11.171605	2025-08-17 03:52:11.171605
77	Diamondback Hybrid Plus 2018	Storm	Diamondback	д20	черный	2025-05-09	153112.00	в прокате	4	2025-03-02	89	Проверен и смазан привод	2025-08-17 03:52:11.172249	2025-08-17 03:52:11.172249
78	GT Blaze 2023	Explorer	GT	д20	белый	2025-01-19	55431.00	в ремонте	2	2025-07-03	30	Настроена подвеска	2025-08-17 03:52:11.172796	2025-08-17 03:52:11.172796
79	Schwinn Thunder 2024	Road Runner	Schwinn	27.5"	розовый	2024-04-09	100763.00	в ремонте	1	2025-03-19	85	Отрегулированы тормоза	2025-08-17 03:52:11.173305	2025-08-17 03:52:11.173305
80	GT Cross Country 2024	Enduro Beast	GT	M	фиолетовый	2025-03-06	13829.00	в ремонте	3	2025-04-13	41	Заменены тросики	2025-08-17 03:52:11.173799	2025-08-17 03:52:11.173799
81	Mongoose Thunder 2018	Blaze	Mongoose	20"	оранжевый	2024-08-08	115461.00	в ремонте	2	2025-04-02	55	Отрегулирована высота седла	2025-08-17 03:52:11.174294	2025-08-17 03:52:11.174294
82	Focus Explorer 2022	Pro	Focus	20"	черный	2023-10-27	152075.00	бронь	3	2025-08-02	36	Заменены тросики	2025-08-17 03:52:11.174787	2025-08-17 03:52:11.174787
83	KTM Hybrid Plus 2021	Elite	KTM	д24	красный	2024-04-17	87966.00	требует ремонта	4	2025-06-03	59	Отремонтирован задний переключатель	2025-08-17 03:52:11.175438	2025-08-17 03:52:11.175438
84	Giant Blaze 2023	Explorer	Giant	XS	красный	2023-10-14	77873.00	в ремонте	2	2025-07-17	87	Плановое ТО пройдено	2025-08-17 03:52:11.176072	2025-08-17 03:52:11.176072
85	Diamondback Hybrid Plus 2021	X-Trail	Diamondback	L	фиолетовый	2025-06-10	139367.00	бронь	3	2025-05-13	56	Требует замены тормозных колодок	2025-08-17 03:52:11.176548	2025-08-17 03:52:11.176548
86	Diamondback Warrior 2021	Adventure	Diamondback	д20	оранжевый	2024-12-01	74040.00	в прокате	4	2025-07-14	39	Настроена геометрия руля	2025-08-17 03:52:11.177086	2025-08-17 03:52:11.177086
87	Diamondback Sport 2024	Adventure	Diamondback	M	синий	2025-03-07	93122.00	в ремонте	3	2025-04-30	57	Смазаны подшипники	2025-08-17 03:52:11.177735	2025-08-17 03:52:11.177735
88	Bianchi Elite 2023	Thunder	Bianchi	д20	синий	2023-10-07	39445.00	в ремонте	3	2025-03-29	54	Проверена рама на трещины	2025-08-17 03:52:11.178321	2025-08-17 03:52:11.178321
89	Schwinn Lightning 2024	Enduro Beast	Schwinn	M	фиолетовый	2025-01-02	85713.00	в наличии	1	2025-02-22	83	Проверено состояние вилки	2025-08-17 03:52:11.178811	2025-08-17 03:52:11.178811
90	Specialized Road Runner 2020	Mountain Pro	Specialized	29"	серый	2024-04-17	21302.00	в ремонте	5	2025-07-22	45	Заменена кассета	2025-08-17 03:52:11.179265	2025-08-17 03:52:11.179265
91	Merida Blaze 2022	Blaze	Merida	д24	розовый	2025-03-18	48146.00	в наличии	1	2025-06-23	70	Отрегулирована высота седла	2025-08-17 03:52:11.179794	2025-08-17 03:52:11.179794
92	Giant Road Runner 2020	Warrior	Giant	XXL	зеленый	2024-01-04	158596.00	в прокате	4	2025-06-04	58	Настроена геометрия руля	2025-08-17 03:52:11.180412	2025-08-17 03:52:11.180412
93	GT Sport 2019	Pro	GT	L	черный	2025-02-08	108351.00	в наличии	4	2025-03-27	43	Проверен и смазан привод	2025-08-17 03:52:11.180913	2025-08-17 03:52:11.180913
94	Fuji City Cruiser 2020	Lightning	Fuji	д20	красный	2024-12-05	108877.00	требует ремонта	5	2025-03-25	74	Заменены грипсы	2025-08-17 03:52:11.181439	2025-08-17 03:52:11.181439
95	Norco Enduro Beast 2021	Sport	Norco	S	оранжевый	2024-07-19	15141.00	требует ремонта	5	2025-06-28	33	Проверено состояние вилки	2025-08-17 03:52:11.181969	2025-08-17 03:52:11.181969
96	Cannondale Adventure 2022	City Cruiser	Cannondale	XXL	розовый	2025-02-11	30150.00	в ремонте	4	2025-07-13	72	Настроена передача	2025-08-17 03:52:11.182466	2025-08-17 03:52:11.182466
97	Mongoose City Cruiser 2022	Thunder	Mongoose	20"	розовый	2025-03-13	34106.00	бронь	2	2025-06-08	85	Проведена полная диагностика	2025-08-17 03:52:11.18306	2025-08-17 03:52:11.18306
98	Scott Elite 2022	Sport	Scott	XL	фиолетовый	2024-05-01	55525.00	в ремонте	4	2025-06-07	65	Смазаны подшипники	2025-08-17 03:52:11.183667	2025-08-17 03:52:11.183667
99	Fuji X-Trail 2021	Lightning	Fuji	XXL	серый	2024-11-26	21019.00	бронь	2	2025-04-12	49	Настроена система торможения	2025-08-17 03:52:11.184143	2025-08-17 03:52:11.184143
100	Focus Lightning 2020	Hybrid Plus	Focus	20"	оранжевый	2024-04-20	74932.00	в прокате	2	2025-07-15	43	Настроена передача	2025-08-17 03:52:11.184612	2025-08-17 03:52:11.184612
101	Diamondback Adventure 2022	Lightning	Diamondback	XXL	красный	2025-05-13	15402.00	в наличии	3	2025-06-24	39	Отрегулированы тормоза	2025-08-17 03:52:11.18507	2025-08-17 03:52:11.18507
102	Bulls Mountain Pro 2021	Enduro Beast	Bulls	д20	фиолетовый	2024-12-07	137970.00	в ремонте	2	2025-06-17	63	Настроена подвеска	2025-08-17 03:52:11.185549	2025-08-17 03:52:11.185549
103	Diamondback Enduro Beast 2024	Adventure	Diamondback	L	розовый	2025-03-13	53221.00	в ремонте	3	2025-06-30	33	Смазаны подшипники	2025-08-17 03:52:11.186164	2025-08-17 03:52:11.186164
104	Mongoose Road Runner 2020	X-Trail	Mongoose	XL	черный	2024-03-26	65034.00	в наличии	4	2025-03-07	71	Проверена рама на трещины	2025-08-17 03:52:11.186795	2025-08-17 03:52:11.186795
105	Scott Adventure 2024	Elite	Scott	XL	белый	2024-04-09	31919.00	в ремонте	4	2025-08-12	66	Требует замены тормозных колодок	2025-08-17 03:52:11.187423	2025-08-17 03:52:11.187423
106	Trek Lightning 2020	Explorer	Trek	26"	оранжевый	2024-03-13	80468.00	требует ремонта	3	2025-04-10	55	Заменен переключатель	2025-08-17 03:52:11.187984	2025-08-17 03:52:11.187984
107	Giant X-Trail 2019	Road Runner	Giant	29"	серый	2024-09-20	80371.00	требует ремонта	4	2025-04-09	31	Проверена рама на трещины	2025-08-17 03:52:11.188623	2025-08-17 03:52:11.188623
108	Giant Lightning 2024	Explorer	Giant	27.5"	оранжевый	2025-07-19	61837.00	бронь	4	2025-02-21	89	Отремонтирован задний переключатель	2025-08-17 03:52:11.189142	2025-08-17 03:52:11.189142
109	GT Adventure 2022	Storm	GT	24"	зеленый	2025-04-14	139488.00	в ремонте	1	2025-05-06	60	Проверено состояние вилки	2025-08-17 03:52:11.18965	2025-08-17 03:52:11.18965
110	Bulls City Cruiser 2020	Pro	Bulls	XXL	оранжевый	2024-10-06	108651.00	в прокате	5	2025-06-26	30	Плановое ТО пройдено	2025-08-17 03:52:11.190146	2025-08-17 03:52:11.190146
111	Focus Cross Country 2020	Sport	Focus	S	черный	2024-01-12	27994.00	в прокате	2	2025-05-10	64	Заменена цепь	2025-08-17 03:52:11.190639	2025-08-17 03:52:11.190639
112	Cube Explorer 2024	City Cruiser	Cube	XS	зеленый	2024-08-06	77533.00	в прокате	3	2025-07-28	57	Проверен и смазан привод	2025-08-17 03:52:11.191139	2025-08-17 03:52:11.191139
113	Norco Thunder 2024	Enduro Beast	Norco	S	розовый	2024-08-19	16442.00	в наличии	1	2025-04-19	39	Отрегулированы тормоза	2025-08-17 03:52:11.191632	2025-08-17 03:52:11.191632
114	Merida Enduro Beast 2023	Explorer	Merida	26"	розовый	2025-04-20	133982.00	в прокате	5	2025-08-15	75	Проверен и смазан привод	2025-08-17 03:52:11.192134	2025-08-17 03:52:11.192134
115	Bianchi Elite 2024	Sport	Bianchi	27.5"	белый	2024-11-23	158515.00	в наличии	4	2025-02-21	40	Отрегулирована высота седла	2025-08-17 03:52:11.192667	2025-08-17 03:52:11.192667
116	Schwinn Urban Elite 2024	Elite	Schwinn	20"	оранжевый	2025-02-03	98545.00	в прокате	5	2025-04-23	67	Смазаны подшипники	2025-08-17 03:52:11.193714	2025-08-17 03:52:11.193714
117	Trek Urban Elite 2022	Cross Country	Trek	д20	розовый	2024-01-21	47804.00	бронь	4	2025-05-16	56	Отрегулирована высота седла	2025-08-17 03:52:11.194693	2025-08-17 03:52:11.194693
118	Cannondale City Cruiser 2018	Lightning	Cannondale	XXL	желтый	2024-08-31	70521.00	в ремонте	1	2025-07-05	69	Настроена передача	2025-08-17 03:52:11.195384	2025-08-17 03:52:11.195384
119	Norco Adventure 2022	Pro	Norco	XS	зеленый	2023-10-17	128275.00	в наличии	3	2025-05-25	57	Заменена цепь	2025-08-17 03:52:11.195866	2025-08-17 03:52:11.195866
120	Orbea Pro 2021	Road Runner	Orbea	26"	фиолетовый	2023-11-24	158449.00	в наличии	4	2025-06-04	85	Отрегулированы тормоза	2025-08-17 03:52:11.196426	2025-08-17 03:52:11.196426
\.


--
-- TOC entry 4993 (class 0 OID 16654)
-- Dependencies: 234
-- Data for Name: brands; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.brands (id, name, country, website, description, logo_url, created_at, updated_at) FROM stdin;
1	Trek	USA	\N	Американский производитель велосипедов	\N	2025-08-22 22:44:49.162182	2025-08-22 22:44:49.162182
2	Specialized	USA	\N	Премиальный бренд велосипедов	\N	2025-08-22 22:44:49.162182	2025-08-22 22:44:49.162182
3	Giant	Taiwan	\N	Крупнейший производитель велосипедов в мире	\N	2025-08-22 22:44:49.162182	2025-08-22 22:44:49.162182
4	Cannondale	USA	\N	Высокопроизводительные велосипеды	\N	2025-08-22 22:44:49.162182	2025-08-22 22:44:49.162182
5	Scott	Switzerland	\N	Швейцарский производитель велосипедов	\N	2025-08-22 22:44:49.162182	2025-08-22 22:44:49.162182
\.


--
-- TOC entry 4995 (class 0 OID 16667)
-- Dependencies: 236
-- Data for Name: currency_rates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.currency_rates (id, currency_code, date, created_at, rate_to_uah) FROM stdin;
19	UAH	2025-09-11	2025-09-11 20:34:25.013095	\N
20	UAH	2025-09-10	2025-09-11 20:40:22.000055	\N
21	USD	2025-09-11	2025-09-11 23:08:00.985178	41.5000
22	USD	2025-09-01	2025-09-12 03:52:08.696839	41.5500
23	USD	2025-09-12	2025-09-12 04:37:10.381635	41.5500
\.


--
-- TOC entry 5000 (class 0 OID 16741)
-- Dependencies: 241
-- Data for Name: maintenance_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.maintenance_events (id, bike_id, maintenance_type, status, scheduled_at, scheduled_user_id, scheduled_for, scheduled_for_user_id, started_at, started_user_id, completed_at, completed_user_id, tested_at, tested_user_id, description, notes, parts_need, parts_needed_at, parts_ordered_at, parts_delivered_at, created_at) FROM stdin;
1	1	current	planned	2025-08-23 18:40:20.990238	1	2025-08-23 20:40:20.990238	\N	\N	\N	\N	\N	\N	\N	Плановая замена тормозных колодок и настройка переключателей	\N	not_needed	\N	\N	\N	2025-08-23 18:40:20.990238
2	2	weekly	in_progress	2025-08-22 18:40:21.005076	1	2025-08-23 14:40:21.005076	\N	2025-08-23 15:40:21.005076	1	\N	\N	\N	\N	Еженедельное ТО: замена цепи и звездочек кассеты	\N	ordered	2025-08-23 16:40:21.005076	2025-08-23 17:40:21.005076	\N	2025-08-22 18:40:21.005076
3	3	longterm	completed	2025-08-16 18:40:21.006537	1	2025-08-18 18:40:21.006537	\N	2025-08-19 18:40:21.006537	1	2025-08-22 18:40:21.006537	1	2025-08-23 12:40:21.006537	1	Капитальный ремонт: замена каретки, рулевой колонки и втулок колес	\N	not_needed	\N	\N	\N	2025-08-16 18:40:21.006537
4	4	current	completed	2025-08-20 18:40:21.007916	1	2025-08-21 18:40:21.007916	\N	2025-08-22 06:40:21.007916	1	2025-08-23 14:40:21.007916	1	\N	\N	Замена амортизационной вилки и настройка подвески	Запчасти доставлены вовремя. Установка прошла без проблем. Велосипед протестирован и готов к эксплуатации.	delivered	2025-08-21 10:40:21.007916	2025-08-21 14:40:21.007916	2025-08-22 10:40:21.007916	2025-08-20 18:40:21.007916
11	3	weekly	planned	\N	\N	2025-09-08 09:00:00	\N	\N	\N	\N	\N	\N	\N	Еженедельное ТО (Пн)	Автоматически созданное событие на основе еженедельного расписания	not_needed	\N	\N	\N	2025-09-06 11:34:06.839875
12	3	weekly	planned	\N	\N	2025-09-09 09:00:00	\N	\N	\N	\N	\N	\N	\N	Еженедельное ТО (Вт)	Автоматически созданное событие на основе еженедельного расписания	not_needed	\N	\N	\N	2025-09-06 11:34:37.978227
13	3	weekly	planned	\N	\N	2025-09-10 09:00:00	\N	\N	\N	\N	\N	\N	\N	Еженедельное ТО (Ср)	Автоматически созданное событие на основе еженедельного расписания	not_needed	\N	\N	\N	2025-09-06 11:50:14.606679
14	5	weekly	planned	\N	\N	2025-09-10 09:00:00	\N	\N	\N	\N	\N	\N	\N	Еженедельное ТО (Ср)	Автоматически созданное событие на основе еженедельного расписания	not_needed	\N	\N	\N	2025-09-06 12:42:33.62572
15	5	weekly	planned	\N	\N	2025-09-11 09:00:00	\N	\N	\N	\N	\N	\N	\N	Еженедельное ТО (Чт)	Автоматически созданное событие на основе еженедельного расписания	not_needed	\N	\N	\N	2025-09-06 12:42:33.62572
\.


--
-- TOC entry 4983 (class 0 OID 16481)
-- Dependencies: 224
-- Data for Name: maintenance_parts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.maintenance_parts (id, "событие_id", part_model_id, "использовано", "цена_за_шт", notes, created_at) FROM stdin;
\.


--
-- TOC entry 4979 (class 0 OID 16433)
-- Dependencies: 220
-- Data for Name: part_models; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.part_models (id, name, category, brand, model, description, unit_price, supplier, part_number, created_at, updated_at) FROM stdin;
1	Тестовая деталь	test	\N	\N	\N	15.50	\N	\N	2025-08-08 19:25:55.902772	2025-08-08 19:25:55.902772
2	Тестовая деталь	test	\N	\N	\N	15.50	\N	\N	2025-08-08 19:26:19.062055	2025-08-08 19:26:19.062055
3	Тормозные колодки Shimano	тормоза	Shimano	BR-M315	Дисковые тормозные колодки	850.00	VeloShop	Y8FN98010	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
4	Цепь KMC X11	трансмиссия	KMC	X11-93	11-скоростная цепь	2400.00	BikeWorld	X11-93-GD	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
5	Покрышка Continental	колеса	Continental	Grand Prix 5000	700x25c шоссейная	4500.00	TireExpress	GP5000-70025	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
6	Камера Schwalbe 26"	колеса	Schwalbe	SV13	Камера 26x1.5-2.4	650.00	VeloShop	SV13-26	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
7	Звездочки Sram	трансмиссия	Sram	PG-1130	Кассета 11-42T	3200.00	BikeWorld	PG1130-1142	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
8	Фонарь передний Cateye	освещение	Cateye	Volt 800	USB перезаряжаемый	5800.00	LightStore	HL-EL471RC	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
9	Фонарь задний Lezyne	освещение	Lezyne	Strip Drive	LED задний фонарь	2100.00	LightStore	LZN-STRIP	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
10	Седло Selle Royal	оборудование	Selle Royal	Scientia M1	Спортивное седло	3800.00	ComfortRide	SR-SCI-M1	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
11	Грипсы Ergon	оборудование	Ergon	GA2 Fat	Анатомические ручки	2900.00	ComfortRide	GA2-FAT-L	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
12	Тросик тормозной Jagwire	тормоза	Jagwire	Elite Link	Нержавеющий трос	450.00	VeloShop	JW-ELK-2000	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
13	Рубашка тросика Jagwire	тормоза	Jagwire	Elite Link	Оплетка троса 5мм	320.00	VeloShop	JW-ELK-5MM	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
14	Педали Shimano SPD	оборудование	Shimano	PD-M540	Контактные педали	4200.00	BikeWorld	PD-M540-BK	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
15	Ось заднего колеса	колеса	Novatec	D142SB	Втулка 142x12 Thru	2800.00	WheelTech	D142SB-32H	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
16	Спицы DT Swiss	колеса	DT Swiss	Competition	2.0/1.8/2.0 мм	85.00	WheelTech	DT-COMP-264	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
17	Смазка цепи Finish Line	обслуживание	Finish Line	Wet Lube	Влажная смазка 60мл	750.00	VeloShop	FL-WET-60	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
18	Обезжириватель Muc-Off	обслуживание	Muc-Off	Degreaser	Очиститель 500мл	1200.00	VeloShop	MO-DEG-500	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
19	Шестигранник Park Tool	инструменты	Park Tool	AWS-10	Набор ключей 1.5-10мм	3500.00	ToolMaster	PK-AWS10	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
20	Насос напольный Topeak	инструменты	Topeak	Joe Blow Sport	С манометром до 11 bar	4800.00	ToolMaster	TK-JBS	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
\.


--
-- TOC entry 4981 (class 0 OID 16445)
-- Dependencies: 222
-- Data for Name: part_stock; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.part_stock (id, part_model_id, quantity, min_stock, max_stock, warehouse_location, last_updated, notes) FROM stdin;
1	3	25	10	94	Склад запчастей	2025-08-08 20:18:00.824274	\N
2	4	5	11	77	Мастерская	2025-08-08 20:18:00.824274	\N
3	5	44	8	81	Мастерская	2025-08-08 20:18:00.824274	\N
4	6	36	11	60	Склад запчастей	2025-08-08 20:18:00.824274	\N
5	7	9	10	87	Мастерская	2025-08-08 20:18:00.824274	\N
6	8	44	4	96	Мастерская	2025-08-08 20:18:00.824274	\N
7	9	33	8	93	Мастерская	2025-08-08 20:18:00.824274	\N
8	10	14	5	95	Мастерская	2025-08-08 20:18:00.824274	\N
9	11	23	3	77	Склад запчастей	2025-08-08 20:18:00.824274	\N
10	12	31	9	73	Склад запчастей	2025-08-08 20:18:00.824274	\N
11	13	32	4	92	Склад запчастей	2025-08-08 20:18:00.824274	\N
12	14	28	7	60	Мастерская	2025-08-08 20:18:00.824274	\N
13	15	36	2	93	Мастерская	2025-08-08 20:18:00.824274	\N
14	16	47	7	80	Склад запчастей	2025-08-08 20:18:00.824274	\N
15	17	31	6	90	Резервный склад	2025-08-08 20:18:00.824274	\N
16	18	43	5	61	Основной склад	2025-08-08 20:18:00.824274	\N
17	19	22	9	96	Склад запчастей	2025-08-08 20:18:00.824274	\N
18	20	7	10	69	Склад запчастей	2025-08-08 20:18:00.824274	\N
\.


--
-- TOC entry 4985 (class 0 OID 16503)
-- Dependencies: 226
-- Data for Name: purchase_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_requests (id, part_model_id, requested_quantity, reason, status, requested_by, requested_at, approved_by, approved_at, notes, urgent) FROM stdin;
1	3	20	Низкий запас тормозных колодок	pending	3	2025-08-08 20:18:00.824274	\N	\N	\N	t
2	5	5	Заказ для планового ремонта	approved	2	2025-08-08 20:18:00.824274	7	2025-08-03 18:09:17.74	\N	f
3	8	3	Запрос на новые фонари	pending	4	2025-08-08 20:18:00.824274	\N	\N	\N	f
4	11	10	Замена изношенных грипс	approved	5	2025-08-08 20:18:00.824274	2	2025-08-08 14:09:21.273	\N	f
5	15	2	Срочный ремонт колеса	pending	3	2025-08-08 20:18:00.824274	\N	\N	\N	t
6	18	6	Пополнение расходных материалов	approved	6	2025-08-08 20:18:00.824274	7	2025-08-03 06:15:08.836	\N	f
7	10	4	Замена седел на арендных велосипедах	pending	4	2025-08-08 20:18:00.824274	\N	\N	\N	f
8	17	12	Регулярное обслуживание	approved	3	2025-08-08 20:18:00.824274	2	2025-08-06 13:06:01.462	\N	f
\.


--
-- TOC entry 4989 (class 0 OID 16581)
-- Dependencies: 230
-- Data for Name: repair_status_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.repair_status_history (id, repair_id, old_status, new_status, changed_by_id, changed_at, reason, notes, duration_in_previous_status) FROM stdin;
\.


--
-- TOC entry 4977 (class 0 OID 16405)
-- Dependencies: 218
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, name, email, phone, role, is_active, created_at, updated_at) FROM stdin;
1	Test User	test@example.com	\N	mechanic	t	2025-08-08 19:23:50.381037	2025-08-08 19:23:50.381037
2	Иванов Сергей Петрович	sergey.ivanov@bikerental.ru	+7-925-123-4567	manager	t	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
3	Петрова Анна Владимировна	anna.petrova@bikerental.ru	+7-916-987-6543	mechanic	t	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
4	Smith John	john.smith@bikerental.ru	+7-903-555-0123	employee	t	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
5	Козлов Михаил Александрович	\N	+7-905-777-8899	mechanic	t	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
6	Johnson Sarah	sarah.j@bikerental.ru	\N	employee	t	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
7	Сидоров Алексей Викторович	alexey.sidorov@bikerental.ru	+7-926-444-3333	manager	t	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
8	Garcia Maria	\N	+7-915-222-1111	employee	t	2025-08-08 20:18:00.824274	2025-08-08 20:18:00.824274
\.


--
-- TOC entry 4987 (class 0 OID 16556)
-- Dependencies: 228
-- Data for Name: weekly_repair_schedule; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.weekly_repair_schedule (id, bike_id, day_of_week, week_interval, is_active, last_scheduled, next_scheduled, created_at, created_by_id, updated_at) FROM stdin;
59	5	3	1	t	\N	\N	2025-09-06 12:36:18.950181	\N	2025-09-06 12:36:18.950181
60	5	4	1	t	\N	\N	2025-09-06 12:36:18.950181	\N	2025-09-06 12:36:18.950181
\.


--
-- TOC entry 5026 (class 0 OID 0)
-- Dependencies: 231
-- Name: bike_status_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.bike_status_history_id_seq', 1, false);


--
-- TOC entry 5027 (class 0 OID 0)
-- Dependencies: 238
-- Name: bikes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.bikes_id_seq', 19, true);


--
-- TOC entry 5028 (class 0 OID 0)
-- Dependencies: 233
-- Name: brands_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.brands_id_seq', 5, true);


--
-- TOC entry 5029 (class 0 OID 0)
-- Dependencies: 235
-- Name: currency_rates_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.currency_rates_id_seq', 23, true);


--
-- TOC entry 5030 (class 0 OID 0)
-- Dependencies: 240
-- Name: maintenance_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.maintenance_events_id_seq', 15, true);


--
-- TOC entry 5031 (class 0 OID 0)
-- Dependencies: 223
-- Name: maintenance_parts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.maintenance_parts_id_seq', 15, true);


--
-- TOC entry 5032 (class 0 OID 0)
-- Dependencies: 219
-- Name: part_models_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.part_models_id_seq', 20, true);


--
-- TOC entry 5033 (class 0 OID 0)
-- Dependencies: 221
-- Name: part_stock_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.part_stock_id_seq', 18, true);


--
-- TOC entry 5034 (class 0 OID 0)
-- Dependencies: 225
-- Name: purchase_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.purchase_requests_id_seq', 8, true);


--
-- TOC entry 5035 (class 0 OID 0)
-- Dependencies: 229
-- Name: repair_status_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.repair_status_history_id_seq', 5, true);


--
-- TOC entry 5036 (class 0 OID 0)
-- Dependencies: 217
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 8, true);


--
-- TOC entry 5037 (class 0 OID 0)
-- Dependencies: 227
-- Name: weekly_repair_schedule_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.weekly_repair_schedule_id_seq', 63, true);


--
-- TOC entry 4783 (class 2606 OID 16611)
-- Name: bike_status_history bike_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bike_status_history
    ADD CONSTRAINT bike_status_history_pkey PRIMARY KEY (id);


--
-- TOC entry 4796 (class 2606 OID 16697)
-- Name: bikes bikes_internal_article_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bikes
    ADD CONSTRAINT bikes_internal_article_key UNIQUE (internal_article);


--
-- TOC entry 4798 (class 2606 OID 16695)
-- Name: bikes bikes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bikes
    ADD CONSTRAINT bikes_pkey PRIMARY KEY (id);


--
-- TOC entry 4788 (class 2606 OID 16665)
-- Name: brands brands_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_name_key UNIQUE (name);


--
-- TOC entry 4790 (class 2606 OID 16663)
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);


--
-- TOC entry 4792 (class 2606 OID 16675)
-- Name: currency_rates currency_rates_currency_code_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.currency_rates
    ADD CONSTRAINT currency_rates_currency_code_date_key UNIQUE (currency_code, date);


--
-- TOC entry 4794 (class 2606 OID 16673)
-- Name: currency_rates currency_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.currency_rates
    ADD CONSTRAINT currency_rates_pkey PRIMARY KEY (id);


--
-- TOC entry 4810 (class 2606 OID 16754)
-- Name: maintenance_events maintenance_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maintenance_events
    ADD CONSTRAINT maintenance_events_pkey PRIMARY KEY (id);


--
-- TOC entry 4768 (class 2606 OID 16491)
-- Name: maintenance_parts maintenance_parts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maintenance_parts
    ADD CONSTRAINT maintenance_parts_pkey PRIMARY KEY (id);


--
-- TOC entry 4764 (class 2606 OID 16443)
-- Name: part_models part_models_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.part_models
    ADD CONSTRAINT part_models_pkey PRIMARY KEY (id);


--
-- TOC entry 4766 (class 2606 OID 16457)
-- Name: part_stock part_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.part_stock
    ADD CONSTRAINT part_stock_pkey PRIMARY KEY (id);


--
-- TOC entry 4770 (class 2606 OID 16514)
-- Name: purchase_requests purchase_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT purchase_requests_pkey PRIMARY KEY (id);


--
-- TOC entry 4781 (class 2606 OID 16590)
-- Name: repair_status_history repair_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_status_history
    ADD CONSTRAINT repair_status_history_pkey PRIMARY KEY (id);


--
-- TOC entry 4774 (class 2606 OID 16791)
-- Name: weekly_repair_schedule unique_bike_day_schedule; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.weekly_repair_schedule
    ADD CONSTRAINT unique_bike_day_schedule UNIQUE (bike_id, day_of_week);


--
-- TOC entry 4760 (class 2606 OID 16416)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4762 (class 2606 OID 16414)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4776 (class 2606 OID 16567)
-- Name: weekly_repair_schedule weekly_repair_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.weekly_repair_schedule
    ADD CONSTRAINT weekly_repair_schedule_pkey PRIMARY KEY (id);


--
-- TOC entry 4784 (class 1259 OID 16632)
-- Name: idx_bike_status_history_bike; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bike_status_history_bike ON public.bike_status_history USING btree (bike_id);


--
-- TOC entry 4785 (class 1259 OID 16633)
-- Name: idx_bike_status_history_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bike_status_history_date ON public.bike_status_history USING btree (changed_at);


--
-- TOC entry 4786 (class 1259 OID 16634)
-- Name: idx_bike_status_history_repair; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bike_status_history_repair ON public.bike_status_history USING btree (repair_id) WHERE (repair_id IS NOT NULL);


--
-- TOC entry 4799 (class 1259 OID 16713)
-- Name: idx_bikes_brand_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bikes_brand_id ON public.bikes USING btree (brand_id);


--
-- TOC entry 4800 (class 1259 OID 16715)
-- Name: idx_bikes_condition_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bikes_condition_status ON public.bikes USING btree (condition_status);


--
-- TOC entry 4801 (class 1259 OID 16717)
-- Name: idx_bikes_document_details; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bikes_document_details ON public.bikes USING gin (document_details);


--
-- TOC entry 4802 (class 1259 OID 16718)
-- Name: idx_bikes_installed_components; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bikes_installed_components ON public.bikes USING gin (installed_components);


--
-- TOC entry 4803 (class 1259 OID 16714)
-- Name: idx_bikes_internal_article; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bikes_internal_article ON public.bikes USING btree (internal_article);


--
-- TOC entry 4804 (class 1259 OID 16716)
-- Name: idx_bikes_photos; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bikes_photos ON public.bikes USING gin (photos);


--
-- TOC entry 4805 (class 1259 OID 16785)
-- Name: idx_maintenance_events_bike_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_maintenance_events_bike_id ON public.maintenance_events USING btree (bike_id);


--
-- TOC entry 4806 (class 1259 OID 16788)
-- Name: idx_maintenance_events_parts_need; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_maintenance_events_parts_need ON public.maintenance_events USING btree (parts_need);


--
-- TOC entry 4807 (class 1259 OID 16786)
-- Name: idx_maintenance_events_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_maintenance_events_status ON public.maintenance_events USING btree (status);


--
-- TOC entry 4808 (class 1259 OID 16787)
-- Name: idx_maintenance_events_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_maintenance_events_type ON public.maintenance_events USING btree (maintenance_type);


--
-- TOC entry 4777 (class 1259 OID 16630)
-- Name: idx_repair_history_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_history_date ON public.repair_status_history USING btree (changed_at);


--
-- TOC entry 4778 (class 1259 OID 16629)
-- Name: idx_repair_history_repair; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_history_repair ON public.repair_status_history USING btree (repair_id);


--
-- TOC entry 4779 (class 1259 OID 16631)
-- Name: idx_repair_history_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_repair_history_user ON public.repair_status_history USING btree (changed_by_id);


--
-- TOC entry 4771 (class 1259 OID 16627)
-- Name: idx_weekly_schedule_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_weekly_schedule_active ON public.weekly_repair_schedule USING btree (is_active, next_scheduled) WHERE (is_active = true);


--
-- TOC entry 4772 (class 1259 OID 16628)
-- Name: idx_weekly_schedule_day; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_weekly_schedule_day ON public.weekly_repair_schedule USING btree (day_of_week, is_active);


--
-- TOC entry 4830 (class 2620 OID 16641)
-- Name: maintenance_parts trigger_update_repair_cost; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_repair_cost AFTER INSERT OR DELETE OR UPDATE ON public.maintenance_parts FOR EACH ROW EXECUTE FUNCTION public.update_repair_cost();


--
-- TOC entry 4819 (class 2606 OID 16735)
-- Name: bike_status_history bike_status_history_bike_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bike_status_history
    ADD CONSTRAINT bike_status_history_bike_id_fkey FOREIGN KEY (bike_id) REFERENCES public.bikes(id);


--
-- TOC entry 4820 (class 2606 OID 16622)
-- Name: bike_status_history bike_status_history_changed_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bike_status_history
    ADD CONSTRAINT bike_status_history_changed_by_id_fkey FOREIGN KEY (changed_by_id) REFERENCES public.users(id);


--
-- TOC entry 4821 (class 2606 OID 16698)
-- Name: bikes bikes_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bikes
    ADD CONSTRAINT bikes_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id);


--
-- TOC entry 4822 (class 2606 OID 16703)
-- Name: bikes bikes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bikes
    ADD CONSTRAINT bikes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 4823 (class 2606 OID 16708)
-- Name: bikes bikes_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bikes
    ADD CONSTRAINT bikes_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- TOC entry 4824 (class 2606 OID 16755)
-- Name: maintenance_events maintenance_events_bike_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maintenance_events
    ADD CONSTRAINT maintenance_events_bike_id_fkey FOREIGN KEY (bike_id) REFERENCES public.bikes(id) ON DELETE CASCADE;


--
-- TOC entry 4825 (class 2606 OID 16775)
-- Name: maintenance_events maintenance_events_completed_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maintenance_events
    ADD CONSTRAINT maintenance_events_completed_user_id_fkey FOREIGN KEY (completed_user_id) REFERENCES public.users(id);


--
-- TOC entry 4826 (class 2606 OID 16765)
-- Name: maintenance_events maintenance_events_scheduled_for_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maintenance_events
    ADD CONSTRAINT maintenance_events_scheduled_for_user_id_fkey FOREIGN KEY (scheduled_for_user_id) REFERENCES public.users(id);


--
-- TOC entry 4827 (class 2606 OID 16760)
-- Name: maintenance_events maintenance_events_scheduled_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maintenance_events
    ADD CONSTRAINT maintenance_events_scheduled_user_id_fkey FOREIGN KEY (scheduled_user_id) REFERENCES public.users(id);


--
-- TOC entry 4828 (class 2606 OID 16770)
-- Name: maintenance_events maintenance_events_started_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maintenance_events
    ADD CONSTRAINT maintenance_events_started_user_id_fkey FOREIGN KEY (started_user_id) REFERENCES public.users(id);


--
-- TOC entry 4829 (class 2606 OID 16780)
-- Name: maintenance_events maintenance_events_tested_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maintenance_events
    ADD CONSTRAINT maintenance_events_tested_user_id_fkey FOREIGN KEY (tested_user_id) REFERENCES public.users(id);


--
-- TOC entry 4812 (class 2606 OID 16497)
-- Name: maintenance_parts maintenance_parts_part_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maintenance_parts
    ADD CONSTRAINT maintenance_parts_part_model_id_fkey FOREIGN KEY (part_model_id) REFERENCES public.part_models(id);


--
-- TOC entry 4811 (class 2606 OID 16458)
-- Name: part_stock part_stock_part_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.part_stock
    ADD CONSTRAINT part_stock_part_model_id_fkey FOREIGN KEY (part_model_id) REFERENCES public.part_models(id) ON DELETE CASCADE;


--
-- TOC entry 4813 (class 2606 OID 16525)
-- Name: purchase_requests purchase_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT purchase_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- TOC entry 4814 (class 2606 OID 16515)
-- Name: purchase_requests purchase_requests_part_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT purchase_requests_part_model_id_fkey FOREIGN KEY (part_model_id) REFERENCES public.part_models(id) ON DELETE CASCADE;


--
-- TOC entry 4815 (class 2606 OID 16520)
-- Name: purchase_requests purchase_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_requests
    ADD CONSTRAINT purchase_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- TOC entry 4818 (class 2606 OID 16596)
-- Name: repair_status_history repair_status_history_changed_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.repair_status_history
    ADD CONSTRAINT repair_status_history_changed_by_id_fkey FOREIGN KEY (changed_by_id) REFERENCES public.users(id);


--
-- TOC entry 4816 (class 2606 OID 16730)
-- Name: weekly_repair_schedule weekly_repair_schedule_bike_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.weekly_repair_schedule
    ADD CONSTRAINT weekly_repair_schedule_bike_id_fkey FOREIGN KEY (bike_id) REFERENCES public.bikes(id);


--
-- TOC entry 4817 (class 2606 OID 16575)
-- Name: weekly_repair_schedule weekly_repair_schedule_created_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.weekly_repair_schedule
    ADD CONSTRAINT weekly_repair_schedule_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES public.users(id);


-- Completed on 2025-09-20 00:13:52

--
-- PostgreSQL database dump complete
--

