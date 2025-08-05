# 🔧 Repair System - Technical Design

## 📊 Current Database Analysis (через прямой доступ к БД)

### Existing Tables Structure:
```sql
-- ✅ Основные таблицы уже существуют
bikes (id, bike_number, model, status, year, wheel_size, frame_size, ...)
users (id, username, full_name, role, ...)  
maintenance_events (id, bike_id, "тип_ремонта", "статус_ремонта", "менеджер_id", "исполнитель_id", ...)
part_models (id, "название", "описание", purchase_price, ...)
part_stock (id, part_model_id, "количество_на_складе", ...)
maintenance_parts (id, "событие_id", "деталь_id", "использовано", "нужно", ...)
purchase_requests (id, part_model_id, "количество_нужно", "статус", ...)
```

**⚠️ Особенности текущей структуры:**
- Русские названия колонок в кавычках
- Существующая таблица `maintenance_events` частично покрывает функционал ремонтов
- Связи между таблицами уже настроены правильно

---

## 🚀 План миграции к новой системе ремонтов

### Подход: Эволюционная модернизация (не переписываем с нуля)

**Стратегия:**
1. Расширяем существующую `maintenance_events` → универсальная `repairs`
2. Добавляем недостающий функционал через новые таблицы
3. Поэтапно мигрируем данные и обновляем API

---

## 🏗️ Расширенная схема БД

### 1. Модернизация maintenance_events → repairs
```sql
-- Шаг 1: Добавляем новые колонки к существующей таблице
ALTER TABLE maintenance_events 
ADD COLUMN repair_type VARCHAR(20) DEFAULT 'current' 
    CHECK (repair_type IN ('current', 'weekly', 'longterm'));

ALTER TABLE maintenance_events 
ADD COLUMN priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5);

ALTER TABLE maintenance_events 
ADD COLUMN estimated_duration INTEGER DEFAULT 15;

ALTER TABLE maintenance_events 
ADD COLUMN actual_duration INTEGER;

ALTER TABLE maintenance_events 
ADD COLUMN estimated_cost DECIMAL(10,2) DEFAULT 0;

ALTER TABLE maintenance_events 
ADD COLUMN actual_cost DECIMAL(10,2) DEFAULT 0;

-- Шаг 2: Стандартизируем статусы (маппинг старых на новые)
-- 'запланирован' → 'planned'
-- 'в ремонте' → 'in_progress'  
-- 'ожидает деталей' → 'waiting_parts'
-- 'ремонт выполнен' → 'completed'

-- Шаг 3: Переименовываем таблицу (опционально, для консистентности)
-- ALTER TABLE maintenance_events RENAME TO repairs;
```

### 2. Новая таблица для еженедельного планирования
```sql
CREATE TABLE weekly_repair_schedule (
    id SERIAL PRIMARY KEY,
    bike_id INTEGER NOT NULL REFERENCES bikes(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    is_active BOOLEAN DEFAULT true,
    last_scheduled DATE,
    next_scheduled DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by_id INTEGER REFERENCES users(id),
    UNIQUE(bike_id)
);

CREATE INDEX idx_weekly_schedule_active ON weekly_repair_schedule(is_active, next_scheduled);
```

### 3. История статусов для аудита
```sql
CREATE TABLE repair_status_history (
    id SERIAL PRIMARY KEY,
    repair_id INTEGER NOT NULL REFERENCES maintenance_events(id) ON DELETE CASCADE,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by_id INTEGER REFERENCES users(id),
    changed_at TIMESTAMP DEFAULT NOW(),
    reason TEXT,
    notes TEXT,
    duration_in_previous_status INTEGER
);

CREATE INDEX idx_repair_history_repair ON repair_status_history(repair_id);
```

### 4. История статусов велосипедов (для расчета downtime)
```sql
CREATE TABLE bike_status_history (
    id SERIAL PRIMARY KEY,
    bike_id INTEGER NOT NULL REFERENCES bikes(id) ON DELETE CASCADE,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_at TIMESTAMP DEFAULT NOW(),
    duration_in_previous_status INTEGER,
    reason VARCHAR(100),
    repair_id INTEGER REFERENCES maintenance_events(id),
    changed_by_id INTEGER REFERENCES users(id),
    notes TEXT
);

CREATE INDEX idx_bike_status_history_bike ON bike_status_history(bike_id);
CREATE INDEX idx_bike_status_history_repair ON bike_status_history(repair_id) WHERE repair_id IS NOT NULL;
```

---

## 🔄 Бизнес-логика и триггеры

### Автоматическое обновление статусов
```sql
-- Триггер для логирования изменений статуса ремонта
CREATE OR REPLACE FUNCTION log_repair_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Записываем изменение статуса
    IF OLD."статус_ремонта" IS DISTINCT FROM NEW."статус_ремонта" THEN
        INSERT INTO repair_status_history (
            repair_id, old_status, new_status, changed_at, 
            duration_in_previous_status
        ) VALUES (
            NEW.id, 
            OLD."статус_ремонта", 
            NEW."статус_ремонта", 
            NOW(),
            CASE 
                WHEN OLD.updated_at IS NOT NULL 
                THEN EXTRACT(EPOCH FROM (NOW() - OLD.updated_at))/60
                ELSE NULL 
            END
        );
        
        -- Обновляем статус велосипеда при необходимости
        IF NEW."статус_ремонта" = 'в ремонте' AND NEW.repair_type != 'longterm' THEN
            UPDATE bikes SET status = 'в ремонте' WHERE id = NEW.bike_id;
        ELSIF NEW."статус_ремонта" = 'ремонт выполнен' THEN
            UPDATE bikes SET status = 'в наличии', last_service = CURRENT_DATE 
            WHERE id = NEW.bike_id;
        END IF;
    END IF;
    
    -- Обновляем время обновления
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_repair_status_change
    BEFORE UPDATE ON maintenance_events
    FOR EACH ROW
    EXECUTE FUNCTION log_repair_status_change();
```

### Расчет стоимости ремонта
```sql
-- Триггер для автоматического пересчета стоимости ремонта
CREATE OR REPLACE FUNCTION update_repair_cost()
RETURNS TRIGGER AS $$
BEGIN
    -- Пересчитываем общую стоимость ремонта
    UPDATE maintenance_events SET 
        actual_cost = (
            SELECT COALESCE(SUM("использовано" * "цена_за_шт"), 0) 
            FROM maintenance_parts 
            WHERE "событие_id" = COALESCE(NEW."событие_id", OLD."событие_id")
        ),
        updated_at = NOW()
    WHERE id = COALESCE(NEW."событие_id", OLD."событие_id");
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_repair_cost
    AFTER INSERT OR UPDATE OR DELETE ON maintenance_parts
    FOR EACH ROW
    EXECUTE FUNCTION update_repair_cost();
```

---

## 📋 API Endpoints (расширение существующих)

### Обновленные endpoints
```javascript
// Используем существующий /api/maintenance но расширяем функционал

// GET /api/maintenance - теперь поддерживает фильтры по типу ремонта
GET /api/maintenance?repair_type=weekly&status=planned&bike_id=123

// POST /api/maintenance - добавляем новые поля
POST /api/maintenance
{
  bike_id: 123,
  repair_type: 'current',        // новое поле
  priority: 2,                   // новое поле  
  estimated_duration: 30,        // новое поле
  "тип_ремонта": "экстренный",
  "статус_ремонта": "запланирован",
  "примечания": "Сломался тормозной тросик"
}

// PATCH /api/maintenance/:id/status - обновление статуса
PATCH /api/maintenance/456/status
{
  "статус_ремонта": "в ремонте",
  notes: "Начали ремонт, обнаружили дополнительные проблемы"
}
```

### Новые endpoints для планирования
```javascript
// Управление еженедельным планированием
GET /api/maintenance/weekly-schedule
PUT /api/maintenance/weekly-schedule
POST /api/maintenance/generate-weekly

// Аналитика и отчеты  
GET /api/maintenance/analytics/downtime/:bike_id
GET /api/maintenance/analytics/summary
GET /api/maintenance/status-history/:repair_id
```

---

## 🎨 UI компоненты (используем существующую базу)

### Обновляем существующий MaintenanceTable
```jsx
// Расширяем src/components/MaintenanceTable.jsx
const MaintenanceTable = ({ maintenanceData }) => {
  const getRepairTypeColor = (type) => {
    switch (type) {
      case 'current': return 'var(--color-danger)';
      case 'weekly': return 'var(--color-info)';  
      case 'longterm': return 'var(--color-primary-orange)';
      default: return 'var(--color-text-secondary)';
    }
  };

  const getDateStatus = (plannedDate, currentStatus) => {
    if (!plannedDate || currentStatus === 'ремонт выполнен') return '';
    
    const today = new Date().toDateString();
    const planned = new Date(plannedDate).toDateString();
    
    if (planned < today) return 'overdue';
    if (planned === today) return 'today';
    return 'upcoming';
  };

  return (
    <table className="maintenance-table">
      <thead>
        <tr>
          <th>Велосипед</th>
          <th>Тип ремонта</th>          {/* новая колонка */}
          <th>Статус</th>
          <th>Запланирован на</th>
          <th>Приоритет</th>           {/* новая колонка */}
          <th>Стоимость</th>           {/* новая колонка */}
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        {maintenanceData.map(repair => (
          <tr key={repair.id}>
            <td>#{repair.bike_number}</td>
            <td>
              <span 
                className="repair-type-badge"
                style={{ color: getRepairTypeColor(repair.repair_type) }}
              >
                {repair.repair_type || 'current'}
              </span>
            </td>
            <td>
              <RepairStatusBadge status={repair["статус_ремонта"]} />
            </td>
            <td>
              <span className={`repair-date ${getDateStatus(
                repair["ремонт_запланирован_на"], 
                repair["статус_ремонта"]
              )}`}>
                {formatDate(repair["ремонт_запланирован_на"])}
              </span>
            </td>
            <td>
              <PriorityIndicator priority={repair.priority} />
            </td>
            <td>
              {repair.actual_cost ? `${repair.actual_cost}₽` : '-'}
            </td>
            <td>
              <RepairActionsMenu repair={repair} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

### Новые компоненты
```jsx
const RepairStatusBadge = ({ status }) => (
  <span className={`status-badge repair-status-${status.replace(/\s+/g, '-')}`}>
    {status}
  </span>
);

const PriorityIndicator = ({ priority = 3 }) => {
  const colors = ['#dc2626', '#f59e0b', '#6b7280', '#10b981', '#3b82f6'];
  const labels = ['Критический', 'Высокий', 'Средний', 'Низкий', 'Очень низкий'];
  
  return (
    <span 
      className="priority-indicator"
      style={{ color: colors[priority - 1] }}
    >
      {labels[priority - 1]}
    </span>
  );
};
```

### CSS стили (добавляем к существующим)
```css
/* Типы ремонтов */
.repair-type-badge {
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Статусы ремонтов */
.repair-status-запланирован { 
  background: var(--color-info); 
  color: white; 
}
.repair-status-в-ремонте { 
  background: var(--color-primary-orange); 
  color: white; 
}
.repair-status-ожидает-деталей { 
  background: var(--color-danger); 
  color: white; 
}
.repair-status-ремонт-выполнен { 
  background: var(--color-primary-green); 
  color: white; 
}

/* Индикаторы дат */
.repair-date.overdue { 
  color: var(--color-danger); 
  font-weight: bold; 
}
.repair-date.today { 
  color: var(--color-primary-green); 
  font-weight: bold; 
}
.repair-date.upcoming { 
  color: var(--color-text-secondary); 
}

/* Приоритеты */
.priority-indicator {
  font-weight: 500;
  font-size: 0.875rem;
}
```

---

## 🚀 Implementation Roadmap

### Phase 1: Database Migration ⭐⭐⭐ (текущий спринт)
1. ✅ Анализ текущей структуры БД  
2. 🔄 Добавление новых колонок к `maintenance_events`
3. 🔄 Создание новых таблиц для планирования и истории
4. 🔄 Создание триггеров и функций

### Phase 2: API Enhancement ⭐⭐
1. Расширение существующих endpoints `/api/maintenance`
2. Добавление новых endpoints для планирования
3. Обновление логики создания/обновления ремонтов
4. Интеграция с системой запчастей

### Phase 3: UI Updates ⭐⭐  
1. Обновление `MaintenanceTable.jsx`
2. Создание новых компонентов для управления ремонтами
3. Добавление фильтров и сортировки
4. Интеграция с системой уведомлений

### Phase 4: Automation ⭐
1. Cron job для еженедельного планирования
2. Автоматические уведомления о просроченных ремонтах
3. Аналитика и отчеты
4. Экспорт данных

---

## 📝 Migration Script

```sql
-- migrations/001_repair_system_enhancement.sql

BEGIN;

-- Добавляем новые колонки к существующей таблице
ALTER TABLE maintenance_events 
ADD COLUMN IF NOT EXISTS repair_type VARCHAR(20) DEFAULT 'current' 
    CHECK (repair_type IN ('current', 'weekly', 'longterm')),
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS estimated_duration INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS actual_duration INTEGER,
ADD COLUMN IF NOT EXISTS estimated_cost DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS actual_cost DECIMAL(10,2) DEFAULT 0;

-- Создаем новые таблицы
CREATE TABLE IF NOT EXISTS weekly_repair_schedule (
    id SERIAL PRIMARY KEY,
    bike_id INTEGER NOT NULL REFERENCES bikes(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    is_active BOOLEAN DEFAULT true,
    last_scheduled DATE,
    next_scheduled DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by_id INTEGER REFERENCES users(id),
    UNIQUE(bike_id)
);

CREATE TABLE IF NOT EXISTS repair_status_history (
    id SERIAL PRIMARY KEY,
    repair_id INTEGER NOT NULL REFERENCES maintenance_events(id) ON DELETE CASCADE,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by_id INTEGER REFERENCES users(id),
    changed_at TIMESTAMP DEFAULT NOW(),
    reason TEXT,
    notes TEXT,
    duration_in_previous_status INTEGER
);

CREATE TABLE IF NOT EXISTS bike_status_history (
    id SERIAL PRIMARY KEY,
    bike_id INTEGER NOT NULL REFERENCES bikes(id) ON DELETE CASCADE,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_at TIMESTAMP DEFAULT NOW(),
    duration_in_previous_status INTEGER,
    reason VARCHAR(100),
    repair_id INTEGER REFERENCES maintenance_events(id),
    changed_by_id INTEGER REFERENCES users(id),
    notes TEXT
);

-- Создаем индексы
CREATE INDEX IF NOT EXISTS idx_weekly_schedule_active ON weekly_repair_schedule(is_active, next_scheduled);
CREATE INDEX IF NOT EXISTS idx_repair_history_repair ON repair_status_history(repair_id);
CREATE INDEX IF NOT EXISTS idx_bike_status_history_bike ON bike_status_history(bike_id);
CREATE INDEX IF NOT EXISTS idx_bike_status_history_repair ON bike_status_history(repair_id) WHERE repair_id IS NOT NULL;

COMMIT;
```

---

**Следующий шаг**: Выполнить миграцию БД и начать обновление API endpoints.

**Last Updated**: 2025-01-04