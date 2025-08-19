# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend (Vite + React)
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run lint` - Run ESLint linting
- `npm run preview` - Preview production build

### Backend (Express + PostgreSQL)
- `cd backend && npm start` - Start Express server on port 3001
- Backend must be running for frontend API calls to work

## Architecture Overview

This is a bike rental management system with a React frontend and Express backend.

### Frontend Structure
- **Framework**: React 19 with Vite build tool
- **Routing**: React Router DOM for navigation
- **Layout**: Sidebar navigation with collapsible menu (`src/components/Layout.jsx`)
- **Pages**: Modular page components in `src/pages/` (Home, Maintenance, Parts, Users, etc.)
- **Components**: Reusable UI components in `src/components/`
- **API Proxy**: Vite proxies `/api` requests to backend at localhost:3001

### Backend Structure
- **Framework**: Express.js with ES modules
- **Database**: PostgreSQL with `pg` driver
- **Architecture**: RESTful API with route modules
- **Routes**: Modular route handlers in `backend/routes/`
  - `/api/bikes` - Bike management
  - `/api/users` - User management  
  - `/api/maintenance` - Maintenance events
  - `/api/parts` - Parts inventory
  - `/api/purchase-requests` - Purchase requests
- **Database**: Connection pool configured in `backend/db.js`

### Database Configuration
- PostgreSQL database: `bikerental`
- Default connection: localhost:5432
- Credentials hardcoded in `backend/db.js` (should be moved to env vars)
- **PostgreSQL Path**: `C:\Program Files\PostgreSQL\17\bin` (добавлен в системную PATH)
- **psql command**: Доступен как `/c/Program Files/PostgreSQL/17/bin/psql` или после перезапуска терминала просто `psql`

### Key Development Notes
- Backend uses mixed database references (`pool` vs `db`) - needs consistency
- Some route handlers have duplicate code that should be cleaned up
- Russian language used in UI strings and error messages
- Frontend has placeholder pages for future features (rentals, customers, analytics, settings)

### Running the Application
1. Start PostgreSQL service
2. Start backend: `cd backend && npm start`
3. Start frontend: `npm run dev`
4. Access at http://localhost:5173 (frontend) with API at http://localhost:3001