# AGENTS.md - Developer Guidelines for Dormitory Management System

## Project Overview

This is a full-stack dormitory management application with:
- **Frontend**: Angular 21 with standalone components, signals, and SCSS
- **Backend**: Node.js/Express with MySQL database
- **Real-time**: Socket.IO for notifications
- **Deployment**: Railway (backend), Vercel (frontend)

---

## Build, Lint, and Test Commands

### Frontend (Angular)

```bash
# Install dependencies
npm install

# Start development server (http://localhost:4200)
npm start
# or
ng serve

# Build for production
npm run build

# Watch mode for development
npm run watch

# Run tests
npm test
```

### Backend (Node.js/Express)

```bash
# Install server dependencies
cd server && npm install

# Start server
cd server && npm start
# or with nodemon (auto-reload)
cd server && npm run dev

# Run migrations
cd server && npm run migrate

# Check migration status
cd server && npm run migrate:status

# Reset migrations (drops all tables)
cd server && npm run migrate:reset
```

### Key Notes
- No ESLint/Prettier configured in this project
- Use Prettier settings in `package.json` (printWidth: 100, singleQuote: true)
- Tests use Vitest (configured in package.json devDependencies)

---

## Code Style Guidelines

### General Principles

1. **Write concise code** - Avoid unnecessary complexity
2. **No comments unless requested** - Code should be self-explanatory
3. **Follow existing patterns** - Mimic code style in the codebase

### TypeScript (Frontend)

#### Imports
- Use absolute imports with module aliases (e.g., `@app/`, `@env/`)
- Group imports: Angular core → Angular common → Third-party → App services → App models
- Use `inject()` instead of constructor injection where possible

```typescript
// Good
import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentService, Bill, Payment } from '@app/services/payment.service';
import { AuthService } from '@app/auth/auth.service';
```

#### Naming Conventions
- **Components**: `kebab-case` for files, `PascalCase` for class names
- **Services**: `kebab-case` for files, `PascalCase` for class names ending in `Service`
- **Interfaces**: `PascalCase` ending in `Model` or specific types (e.g., `Bill`, `Payment`)
- **Variables/Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Signals**: `camelCase` with `()` suffix (e.g., `isLoading()`, `payments()`)

#### Signals Usage
- Use signals for component state
- Initialize with `signal<Type>(defaultValue)`
- Access value with `signalName()`
- Update with `signalName.set(value)` or `signalName.update(fn)`

```typescript
// Good
isLoading = signal(false);
payments = signal<Payment[]>([]);

this.isLoading.set(true);
this.payments.update(payments => [...payments, newPayment]);
```

#### Error Handling
- Always use try-catch for async operations
- Set error messages to signals for UI display
- Avoid using `alert()` - use toast notifications or inline error states

```typescript
// Good
try {
  await this.paymentService.makePayment(data);
  this.successMessage.set('Payment submitted successfully!');
  setTimeout(() => this.successMessage.set(''), 5000);
} catch (error: any) {
  this.errorMessage.set(error.message || 'Failed to submit payment');
  setTimeout(() => this.errorMessage.set(''), 5000);
}

// Bad
try {
  await this.paymentService.makePayment(data);
} catch (error) {
  alert('Failed to submit payment'); // Don't use alert
}
```

### HTML Templates

#### Control Flow
- Use Angular 17+ `@if`, `@for`, `@else` control flow syntax
- Avoid `*ngIf` and `*ngFor`

```html
<!-- Good -->
@if (isLoading()) {
  <div class="spinner"></div>
} @else {
  @for (payment of payments(); track payment.id) {
    <div class="payment-item">{{ payment.amount }}</div>
  }
}

<!-- Avoid -->
<div *ngIf="isLoading()" class="spinner"></div>
```

#### Class Binding
- Use conditional class binding with `[class]` or `[ngClass]`

```html
<div class="bill-card" [class.overdue]="bill.status === 'overdue'">
  <span class="status-badge" [class.badge-success]="payment.status === 'verified'">
```

### SCSS/CSS

- Use SCSS with nesting (limited to 2-3 levels deep)
- Follow BEM-like naming for complex components
- Use CSS variables for theming
- Keep styles component-scoped

```scss
// Good
.bill-card {
  padding: 1rem;
  background: white;
  border-radius: 8px;

  .bill-info {
    margin-bottom: 0.5rem;

    .bill-type {
      font-weight: 600;
    }
  }
}
```

### JavaScript (Backend)

#### Naming
- Use `camelCase` for variables and functions
- Use `PascalCase` for class-like constructs
- Use `UPPER_SNAKE_CASE` for constants

#### Error Handling
- Always wrap async controller logic in try-catch
- Return proper error responses with status codes

```javascript
// Good
exports.makePayment = async (req, res) => {
  try {
    // Logic here
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Make payment error:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
};
```

#### Database Queries
- Use parameterized queries to prevent SQL injection
- Use `pool.execute()` for queries without user input
- Use `pool.query()` when LIMIT/OFFSET or dynamic params are needed

```javascript
// Good - using execute (prepared statements)
const [users] = await pool.execute(
  'SELECT * FROM users WHERE id = ?',
  [userId]
);

// Good - using query for dynamic params
const [payments] = await pool.query(
  'SELECT * FROM payments LIMIT ? OFFSET ?',
  [limit, offset]
);
```

#### API Response Format
Always return consistent JSON structure:

```javascript
// Success
res.status(201).json({
  success: true,
  message: 'Operation successful',
  data: { ... }
});

// Error
res.status(400).json({
  error: 'Error message'
});
```

### Database Migrations

- Create numbered migration files in `server/src/migrations/`
- Format: `###_description.sql` (e.g., `001_add_users.sql`)
- Include IGNORE for duplicate column/table errors in migrations
- Test migrations locally before deploying

---

## Important Notes

### Modal/Form Handling
- Always close modals after successful submission
- Reset form state when opening modals
- Use error-state components instead of `alert()`
- Scroll modal to top on validation errors

### Payment Logic
- Calculate remaining balance considering both verified AND pending payments
- Hide "Pay Now" button when pending payments cover remaining balance
- Mark bills as requiring verification when payment is pending
- Always refresh data after successful operations

### API Response Validation
- Frontend services should check for `success: true` in responses
- Handle both success and error responses properly
- Don't assume API always returns expected structure

### Git Workflow
- Commit frequently with descriptive messages
- Push to remote after each task completion
- Create feature branches for new features
