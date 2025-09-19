# Установка проекта на новом компьютере

## Требования

- **Node.js** 18+ ([скачать](https://nodejs.org/))
- **PostgreSQL** 15+ ([скачать](https://www.postgresql.org/download/))
- **Git** ([скачать](https://git-scm.com/))

## Шаги установки

### 1. Клонирование репозитория
```bash
git clone https://github.com/Graf15/bike-rental-app.git
cd bike-rental-app/vite-project
```

### 2. Установка зависимостей
```bash
# Frontend
npm install

# Backend
cd backend
npm install
cd ..
```

### 3. Настройка PostgreSQL

#### Создание базы данных:
```sql
-- Подключиться к PostgreSQL
psql -U postgres

-- Создать базу данных
CREATE DATABASE bikerental;

-- Подключиться к новой БД
\c bikerental
```

#### Импорт структуры:
```bash
psql -U postgres -d bikerental -f database/schema.sql
```

### 4. Настройка подключения к БД

Скопируйте `backend/.env.example` в `backend/.env` и настройте:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bikerental
DB_USER=postgres
DB_PASSWORD=your_password
```

### 5. Запуск приложения

#### Запуск backend:
```bash
cd backend
npm start
```

#### Запуск frontend (в новом терминале):
```bash
cd vite-project
npm run dev
```

### 6. Доступ к приложению
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

## Структура проекта

```
vite-project/
├── backend/           # Express.js API сервер
│   ├── routes/        # API маршруты
│   ├── db.js          # Конфигурация БД
│   └── server.js      # Главный файл сервера
├── src/               # React frontend
│   ├── components/    # React компоненты
│   ├── pages/         # Страницы приложения
│   └── constants/     # Константы и справочники
├── database/          # SQL файлы
└── CLAUDE.md          # Инструкции для Claude Code
```

## Основные команды

### Frontend (Vite + React)
- `npm run dev` - Запуск в режиме разработки
- `npm run build` - Сборка для продакшена
- `npm run lint` - Проверка кода
- `npm run preview` - Просмотр собранной версии

### Backend (Express + PostgreSQL)
- `npm start` - Запуск сервера
- `npm run dev` - Запуск с автоперезагрузкой (если настроено)

## Возможные проблемы

### PostgreSQL не запускается
```bash
# Windows - запуск службы
net start postgresql-x64-15

# Проверка статуса
pg_ctl status
```

### Ошибки подключения к БД
1. Проверьте, что PostgreSQL запущен
2. Убедитесь, что настройки в `backend/db.js` корректны
3. Проверьте права доступа пользователя к БД

### Порты заняты
- Frontend по умолчанию: 5173 (Vite автоматически найдет свободный)
- Backend по умолчанию: 3001

## Дополнительная информация

- **Документация**: См. `CLAUDE.md` для детальной архитектуры
- **База данных**: PostgreSQL с русскоязычным интерфейсом
- **API**: RESTful API с JSON ответами
- **Валюты**: Интеграция с API ПриватБанка для курсов USD/UAH