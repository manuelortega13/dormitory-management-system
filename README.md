# Dorm

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.1.4.

## Prerequisites

- Node.js (v18+)
- MySQL 8.0+
- Angular CLI (`npm install -g @angular/cli`)

## Project Structure

```
├── src/                    # Angular frontend
├── server/                 # Node.js/Express backend
│   ├── src/
│   │   ├── config/         # Database config & schema
│   │   ├── controllers/    # Route handlers
│   │   ├── middleware/     # Auth middleware
│   │   ├── routes/         # API routes
│   │   └── index.js        # Server entry point
│   └── .env                # Environment variables
└── README.md
```

## Backend Server Setup

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `server/.env` with your settings:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=dormitory_db
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=24h
```

### 3. Setup Database

Create the database and run the schema:

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS dormitory_db;"
mysql -u root -p dormitory_db < server/src/config/schema.sql
```

### 4. Run the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The API will be available at `http://localhost:3000`

## Frontend Development Server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token
- `POST /api/auth/refresh` - Refresh JWT token

### Leave Requests
- `GET /api/leave-requests` - Get all requests (filtered by role)
- `GET /api/leave-requests/pending-admin` - Get requests pending admin approval
- `GET /api/leave-requests/pending-parent` - Get requests pending parent approval
- `POST /api/leave-requests` - Create new leave request
- `PUT /api/leave-requests/:id/admin-approve` - Admin approves request
- `PUT /api/leave-requests/:id/admin-decline` - Admin declines request
- `PUT /api/leave-requests/:id/parent-approve` - Parent approves request
- `PUT /api/leave-requests/:id/parent-decline` - Parent declines request
- `GET /api/leave-requests/verify/:qrCode` - Verify QR code (security)
- `PUT /api/leave-requests/:id/record-exit` - Record resident exit
- `PUT /api/leave-requests/:id/record-return` - Record resident return

### Users
- `GET /api/users` - Get all users
- `GET /api/users/residents` - Get all residents

### Rooms
- `GET /api/rooms` - Get all rooms
- `POST /api/rooms` - Create room
- `PUT /api/rooms/:id` - Update room
- `DELETE /api/rooms/:id` - Delete room

## User Roles & Portals

| Role | Portal URL | Description |
|------|------------|-------------|
| `admin` | `/manage` | Manage rooms, residents, approve requests |
| `resident` | `/` | Create leave requests, view QR codes |
| `parent` | `/parent` | Approve child's leave requests |
| `security_guard` | `/security-guard` | Scan QR codes, record exits/returns |

## Leave Request Workflow

1. **Resident** creates a go-out request
2. **Admin/Dean** reviews and approves/declines
3. **Parent** receives notification and approves/declines
4. **QR Code** is generated after both approvals
5. **Resident** shows QR to security guard when leaving
6. **Security** scans QR to record exit
7. **Resident** returns and security scans QR again
8. **Request** is marked as completed
