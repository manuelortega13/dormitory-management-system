# Dormitory Management System - Server

Node.js backend server with MySQL database for the Dormitory Management System.

## Setup

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` with your MySQL credentials:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=dormitory_db
JWT_SECRET=your_secure_jwt_secret
```

### 3. Create Database
Run the SQL schema in MySQL:
```bash
mysql -u root -p < src/config/schema.sql
```

### 4. Start Server
```bash
# Development (with hot reload)
npm run dev

# Production
npm start
```

Server runs on `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh JWT token

### Users
- `GET /api/users` - Get all users (admin)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (admin)

### Rooms
- `GET /api/rooms` - Get all rooms
- `GET /api/rooms/available` - Get available rooms
- `POST /api/rooms` - Create room (admin)
- `PUT /api/rooms/:id` - Update room (admin)
- `POST /api/rooms/:id/assign` - Assign resident (admin)

### Leave Requests
- `GET /api/leave-requests` - Get requests
- `POST /api/leave-requests` - Create request
- `POST /api/leave-requests/:id/approve` - Approve (admin)
- `POST /api/leave-requests/:id/decline` - Decline (admin)

### Check Logs (Security)
- `GET /api/check-logs` - Get all logs
- `GET /api/check-logs/today` - Get today's stats & logs
- `POST /api/check-logs/check-in` - Record check-in
- `POST /api/check-logs/check-out` - Record check-out
- `POST /api/check-logs/scan` - Process QR scan

### Visitors (Security)
- `GET /api/visitors` - Get all visitors
- `GET /api/visitors/current` - Get visitors currently inside
- `POST /api/visitors` - Log new visitor
- `POST /api/visitors/:id/checkout` - Check out visitor

### Incidents (Security)
- `GET /api/incidents` - Get all incidents
- `GET /api/incidents/open` - Get open incidents
- `POST /api/incidents` - Report incident
- `POST /api/incidents/:id/resolve` - Resolve incident

## User Roles
- **admin** - Full access to all features
- **security_guard** - Check-in/out, visitors, incidents
- **resident** - View own data, submit leave requests
