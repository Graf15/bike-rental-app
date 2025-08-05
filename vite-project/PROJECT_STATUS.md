# 🚴 Bike Rental Management System - Project Status

## 📋 Project Overview
Система управления прокатом велосипедов с комплексной функциональностью: учет велосипедов, ремонты, запчасти, персонал, клиенты, прокат, аналитика.

**Принципы разработки:**
- ⚡ Экономия токенов в диалогах
- 🎨 Единообразные стили с базовыми цветами
- 🔄 Самостоятельное тестирование разработчиком
- 📱 Минимальные но функциональные UI компоненты

**Доступные инструменты:**
- 🗄️ **Прямой доступ к PostgreSQL БД** - Claude может самостоятельно запрашивать структуру таблиц, данные, выполнять SQL запросы
- 📁 Доступ к файловой системе проекта
- 🌐 Возможность веб-запросов для тестирования API

---

## 🎨 Design System
### Базовые цвета (CSS переменные в `src/index.css`):
```css
--color-primary-green: rgb(32, 167, 64)      /* Основной зеленый */
--color-primary-green-hover: rgb(30, 151, 58) /* Ховер зеленый */
--color-primary-green-light: rgba(32, 167, 64, 0.1) /* Светлый зеленый */

--color-primary-orange: #FFA500              /* Основной оранжевый */
--color-primary-orange-hover: #e6940a        /* Ховер оранжевый */
--color-primary-orange-light: rgba(255, 165, 0, 0.1) /* Светлый оранжевый */

--color-text-primary: #374151               /* Основной текст */
--color-text-secondary: #6b7280             /* Вторичный текст */
--color-danger: #ef4444                     /* Красный для ошибок */
--color-info: #3b82f6                       /* Синий для информации */
```

---

## 🏗️ Current Architecture

### Frontend (React + Vite)
- **Framework**: React 19 + Vite
- **Routing**: React Router DOM  
- **Structure**: Модульная архитектура с компонентами и страницами
- **Styling**: Единые CSS переменные + компонентные стили

### Backend (Express + PostgreSQL)
- **Framework**: Express.js (ES modules)
- **Database**: PostgreSQL с пулом соединений
- **API**: RESTful endpoints в модульных роутах
- **Structure**: `/backend/routes/` для API endpoints

### Database Schema
- **bikes** - основная таблица велосипедов
- **users** - пользователи системы  
- **maintenance** - события обслуживания
- **parts** - склад запчастей
- **purchase_requests** - заявки на закупку

---

## ✅ Completed Features

### 🚴 Bike Management
- ✅ **BikeTable**: Полная таблица с сортировкой, фильтрацией, действиями
- ✅ **Status Management**: Управление статусами через поповер (ИСПРАВЛЕН)
- ✅ **CRUD Operations**: Создание, редактирование, удаление велосипедов
- ✅ **Filtering**: Мультиселект фильтры по всем параметрам
- ✅ **Sorting**: Сортировка по всем колонкам

### 👥 User Management  
- ✅ **UsersTable**: Отображение пользователей
- ✅ **User CRUD**: Базовые операции с пользователями

### 🧰 Parts Management
- ✅ **PartsTable**: Управление складом запчастей
- ✅ **Stock Tracking**: Учет остатков на складе
- ✅ **Low Stock Alerts**: Предупреждения о низких остатках

### 📦 Purchase Requests
- ✅ **PartsRequests**: Система заявок на закупку
- ✅ **Status Management**: Управление статусами заявок
- ✅ **Integration**: Связь со складом запчастей

### 🎨 UI/UX Components
- ✅ **Layout**: Адаптивная боковая панель с навигацией
- ✅ **Color System**: Единые CSS переменные для всех цветов
- ✅ **Popovers**: Исправлены проблемы с обрезанием в таблицах
- ✅ **Forms**: Стандартизированые формы и кнопки
- ✅ **Status Badges**: Единообразные индикаторы статусов

---

## 🚧 In Progress

### 🔧 Repair System (Current Focus)
**Статус**: 🏗️ Готов к реализации (архитектура завершена)

**Типы ремонтов:**
- `current` - Экстренный ремонт  
- `weekly` - Еженедельное ТО
- `longterm` - Долгосрочное планирование

**Подход**: Эволюционная модернизация существующей `maintenance_events` таблицы

**Текущая структура БД (проанализирована через прямой доступ):**
- ✅ `maintenance_events` - основа для системы ремонтов
- ✅ `maintenance_parts` - связь запчастей с ремонтами  
- ✅ `part_models` + `part_stock` - склад запчастей
- ✅ `purchase_requests` - заявки на закупку
- ✅ Связи между таблицами настроены

**Next Steps (Phase 1 - Database Migration):**
1. ⏳ Выполнить SQL миграцию (добавить колонки к maintenance_events)
2. ⏳ Создать новые таблицы (weekly_repair_schedule, repair_status_history, bike_status_history)
3. ⏳ Добавить триггеры для автоматизации
4. ⏳ Обновить API endpoints

---

## 📅 Planned Features

### 🔧 Repair & Maintenance System
- [ ] **Database Schema**: Таблицы repairs, repair_parts, repair_history
- [ ] **Repair Types**: Current, Weekly, Long-term repairs
- [ ] **Status Management**: planned → in_progress → completed
- [ ] **Parts Integration**: Автоматические заявки на недостающие запчасти
- [ ] **Time Tracking**: Учет времени ремонтов и простоев
- [ ] **Automated Scheduling**: Еженедельное планирование ТО
- [ ] **Cost Calculation**: Автоматический расчет стоимости ремонтов

### 👥 Customer Management
- [ ] **Customer Database**: Постоянные клиенты
- [ ] **Customer Profiles**: История, предпочтения, контакты
- [ ] **Loyalty System**: Программа лояльности

### 🏪 Rental System  
- [ ] **Rental Process**: Процесс выдачи/возврата
- [ ] **Pricing**: Тарифы и скидки
- [ ] **Contracts**: Договоры проката
- [ ] **Time Tracking**: Учет времени проката

### 💰 Sales & Commerce
- [ ] **Parts Sales**: Продажа запчастей
- [ ] **External Repairs**: Ремонт чужих велосипедов
- [ ] **Payment Processing**: Обработка платежей
- [ ] **Receipts**: Чеки и документооборот

### 👷 Staff Management
- [ ] **Employee Tracking**: Учет рабочего времени
- [ ] **Payroll**: Зарплаты (ставка + % от кассы)
- [ ] **Performance**: Метрики эффективности
- [ ] **Schedules**: Графики работы

### 💼 Business Operations
- [ ] **Expenses**: Учет хозрасходов
- [ ] **Analytics**: Отчеты и аналитика
- [ ] **Inventory**: Расширенное управление складом
- [ ] **Reporting**: Финансовые отчеты

---

## 🗂️ File Structure

```
vite-project/
├── backend/
│   ├── routes/           # API endpoints
│   │   ├── bikes.js     ✅ CRUD велосипедов
│   │   ├── users.js     ✅ Управление пользователями  
│   │   ├── parts.js     ✅ Склад запчастей
│   │   ├── purchase-requests.js ✅ Заявки на закупку
│   │   └── maintenance.js ✅ События обслуживания
│   ├── db.js            ✅ Подключение к PostgreSQL
│   └── server.js        ✅ Express сервер
├── src/
│   ├── components/      # Переиспользуемые компоненты
│   │   ├── Layout.jsx   ✅ Основной layout
│   │   ├── BikeTable.jsx ✅ Таблица велосипедов
│   │   ├── BikeStatusPopover.jsx ✅ Управление статусами
│   │   ├── UsersTable.jsx ✅ Таблица пользователей
│   │   ├── PartsTable.jsx ✅ Таблица запчастей
│   │   └── *.css        ✅ Компонентные стили
│   ├── pages/           # Страницы приложения
│   │   ├── Home.jsx     ✅ Главная страница
│   │   ├── Users.jsx    ✅ Управление пользователями
│   │   ├── Parts.jsx    ✅ Склад запчастей
│   │   ├── PartsRequests.jsx ✅ Заявки на закупку
│   │   └── Maintenance.jsx ✅ События обслуживания
│   ├── index.css        ✅ CSS переменные + глобальные стили
│   └── main.jsx         ✅ Точка входа React
├── PROJECT_STATUS.md    📋 Этот файл
└── CLAUDE.md           📚 Документация для Claude
```

---

## 🎯 Current Sprint Goals

1. **Repair System Architecture** - Финализировать схему БД и API
2. **Database Migration** - Создать таблицы для системы ремонтов  
3. **Repair Components** - Базовые UI компоненты для ремонтов
4. **Integration Testing** - Связать ремонты с велосипедами и запчастями

---

## 📝 Development Notes

### Code Conventions
- ES modules везде (import/export)
- Async/await для асинхронного кода
- Единые обработчики ошибок
- Консистентные naming conventions

### Database Patterns  
- SERIAL PRIMARY KEY для всех таблиц
- Timestamps (created_at, updated_at) везде
- Foreign keys с ON DELETE правилами
- Индексы на часто используемые поля

### API Patterns
- RESTful endpoints
- Стандартные HTTP коды ответов
- JSON для всех запросов/ответов
- Обработка ошибок через try/catch

### React Patterns
- Функциональные компоненты + hooks
- Props destructuring
- CSS modules для изоляции стилей
- Единообразные обработчики событий

---

**Last Updated**: 2025-01-04  
**Next Review**: После завершения Repair System архитектуры