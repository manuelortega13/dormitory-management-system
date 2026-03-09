# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack dormitory management system: Angular 21 frontend + Node.js/Express backend + MySQL. Supports role-based portals for residents, parents, admins (including home_dean, vpsas), and security guards. Real-time notifications via Socket.IO.

## Commands

### Frontend (root directory, port 4200)
```bash
npm start                # Dev server at http://localhost:4200
npm run build            # Production build
npm test                 # Unit tests (Vitest)
npm run watch            # Dev build with watch
```

### Backend (server/, port 3000)
```bash
cd server && npm run dev         # Dev server with nodemon
cd server && npm start           # Production server
cd server && npm run migrate     # Run pending DB migrations
cd server && npm run migrate:status  # Check migration state
```

### Running Both Together
Start backend first (`cd server && npm run dev`), then frontend (`npm start`). The frontend proxies `/api` requests to `localhost:3000` via `proxy.conf.json`.

## Architecture

### Frontend (`src/app/`)
- **Angular 21** with standalone components (no NgModules), signals for state, `@if`/`@for` control flow
- **Role-based portals**: `admin/` (`/manage`), `user/` (`/`), `parent/` (`/parent`), `security-guard/` (`/security-guard`)
- **Layouts**: Each portal has a layout component in `layouts/` wrapping its routes
- **Services** (`services/`): HTTP + state via signals and RxJS. Key services: `AuthService`, `PaymentService`, `NotificationService`, `SettingsService`
- **Auth**: JWT stored in localStorage, `auth.interceptor.ts` attaches token, guards in `auth/` enforce role access
- **Environments**: `src/environments/` — dev proxies to localhost, prod points to Railway backend

### Backend (`server/src/`)
- **Express 4.18** with controller/route pattern — no ORM, raw SQL with `mysql2/promise`
- **Controllers** (`controllers/`): Business logic per resource (auth, payment, leave-request, room, user, announcement, notification, check-log, visitor, incident, settings)
- **Routes** (`routes/`): Map endpoints to controllers, apply `authMiddleware` + `roleMiddleware`
- **Middleware** (`middleware/auth.middleware.js`): JWT verification, role-based access. Treats `home_dean` and `vpsas` as admin equivalents
- **Migrations** (`migrations/`): Numbered SQL files (`001_*.sql`, `002_*.sql`). Auto-run on server startup. Tracked in `migrations` table
- **Socket.IO** (`services/socket.service.js`): User-targeted (`user:${id}`) and role-targeted (`role:${role}`) notification rooms

### Key Workflow: Leave Requests
Resident creates request → Admin/Dean approves → Parent approves → QR code generated → Security scans on exit/return → Completed

### Key Workflow: Payments
Admin creates bills → Resident submits payment with e-receipt → Payment pending verification → Admin verifies → Remaining balance updates considering both verified AND pending payments

## Code Conventions

### TypeScript (Frontend)
- Use `inject()` for DI, not constructor injection
- Signals for component state: `signal<Type>(default)`, access with `()`, update with `.set()` / `.update()`
- Absolute imports: `@app/`, `@env/`
- No `alert()` — use toast service or inline error signals
- Use `@if`/`@for`/`@else` control flow, not `*ngIf`/`*ngFor`

### JavaScript (Backend)
- Parameterized queries only: `pool.execute('SELECT * FROM x WHERE id = ?', [id])`
- Use `pool.query()` for dynamic LIMIT/OFFSET
- Consistent response format: `{ success: true, message, data }` or `{ error: "..." }`
- Try-catch in all async controller methods

### SCSS
- Component-scoped SCSS, nesting max 2-3 levels, BEM-like naming
- No CSS framework — custom styles with CSS variables for theming
- Responsive breakpoints: 768px (mobile/desktop), 480px (small mobile)

### Migrations
- Files in `server/src/migrations/`, format: `###_description.sql`
- Use IF NOT EXISTS / IGNORE patterns for idempotency

### Prettier
Configured in root `package.json`: `printWidth: 100`, `singleQuote: true`, Angular HTML parser for `.html` files.

## User Roles
| Role | Portal | Route Prefix |
|------|--------|-------------|
| `resident` | Student portal | `/` |
| `parent` | Parent portal | `/parent` |
| `admin` | Admin dashboard | `/manage` |
| `home_dean` | Admin (dean) | `/manage` |
| `vpsas` | Admin (VP) | `/manage` |
| `security_guard` | Security portal | `/security-guard` |

## Deployment
- **Frontend**: Vercel — `vercel.json` rewrites `/api/*` to Railway backend
- **Backend**: Railway — env vars configured in dashboard
- **Database**: External MySQL instance
