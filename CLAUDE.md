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

## Direct Database Access for Claude

### MCP PostgreSQL Tools Available
Claude has direct access to the PostgreSQL database through MCP tools. This allows for:

1. **Direct SQL execution** without psql command line
2. **Database migrations** execution
3. **Data analysis and cleanup**
4. **Schema modifications**
5. **Constraint creation and management**

### Database Connection Details
- **Host**: localhost
- **Port**: 5432  
- **Database**: bikerental
- **User**: postgres
- **Password**: Available through existing backend connection pool

### How to Use Direct Database Access

**Instead of creating SQL files and asking user to run them manually:**

```javascript
// ❌ Old way - create file and ask user to run
// Create migration file -> Ask user to run psql command

// ✅ New way - use Task tool with MCP PostgreSQL
Task({
  subagent_type: "general-purpose",
  description: "Execute database operation",
  prompt: "Use MCP PostgreSQL tools to connect to database 'bikerental' and execute [specific operation]. The database connection info is available through the existing backend configuration."
})
```

### Common Database Operations via MCP

1. **Schema Changes**:
   - Adding columns, indexes, constraints
   - Creating tables, views, functions
   - Modifying existing structures

2. **Data Operations**:
   - Finding and fixing data inconsistencies
   - Bulk data updates/cleanups
   - Data migration between tables

3. **Analysis**:
   - Query performance analysis
   - Data integrity checks
   - Usage statistics

4. **Constraint Management**:
   - Adding business logic constraints
   - Fixing constraint violations
   - Creating triggers and functions

### Example Successful Operations

**✅ Duplicate Repair Cleanup (2025-01-04)**:
- Found bikes with duplicate active repairs
- Intelligently cleaned duplicates (kept most recent with highest priority)
- Created unique index to prevent future duplicates
- Added trigger functions with detailed error messages
- All done through direct MCP PostgreSQL access

### Key Advantages

1. **Immediate execution** - No need to create files and ask user to run commands
2. **Error handling** - Can immediately see and fix issues
3. **Verification** - Can test and verify operations immediately
4. **Complex operations** - Can perform multi-step database operations in one session
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

### Enhanced Repair System (2025-01-04)
- **Database**: Extended maintenance_events table with repair_type, priority, costs, durations
- **API**: 6 new endpoints for repair management, analytics, weekly scheduling
- **Frontend**: Enhanced MaintenanceTable with priority badges, filtering, cost tracking
- **UI Components**: WeeklyScheduleManager for automated scheduling
- **Business Logic**: Prevents duplicate active repairs through database constraints and API validation

## Git Repository Information
- **GitHub URL**: https://github.com/Graf15/bike-rental-app
- **Local Path**: D:\projects\bike-rental-app
- **Main Branch**: main
- **Last Commit**: d525159 (Объединение с удаленным репозиторием)
- **Git Status**: All changes committed and pushed successfully

## Session Continuation Notes
- **Working Directory**: D:\projects\bike-rental-app
- **Database Password**: 1515 (in backend/db.js)
- **All systems fully functional**: repair system, database constraints, UI components
- **No pending issues**: All todos completed, system tested and working
- **Direct Database Access**: Available via MCP PostgreSQL tools
