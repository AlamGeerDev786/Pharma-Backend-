# PharmaCare Backend API

REST API for PharmaCare — a multi-tenant Pharmacy Management System built with Node.js, Express 5, Prisma ORM, and PostgreSQL.

## Tech Stack

- **Runtime:** Node.js (ES Modules)
- **Framework:** Express 5
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Auth:** JWT (access + refresh tokens)
- **Validation:** Zod
- **Security:** bcryptjs, CORS, role-based access control
- **Performance:** gzip compression, paginated responses, database indexes

## Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma        # Database schema (12 models)
│   └── seed.js              # Demo data seeder
├── src/
│   ├── server.js             # Express entry point
│   ├── config/
│   │   ├── env.js            # Environment variables
│   │   └── database.js       # Prisma client singleton
│   ├── middleware/
│   │   ├── auth.js           # JWT authenticate + authorize(roles)
│   │   └── errorHandler.js   # Global error handler
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── medicine.controller.js
│   │   ├── sale.controller.js
│   │   ├── purchase.controller.js
│   │   ├── supplier.controller.js
│   │   ├── dashboard.controller.js
│   │   ├── report.controller.js
│   │   └── settings.controller.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── medicine.routes.js
│   │   ├── sale.routes.js
│   │   ├── purchase.routes.js
│   │   ├── supplier.routes.js
│   │   ├── dashboard.routes.js
│   │   ├── report.routes.js
│   │   └── settings.routes.js
│   └── utils/
│       └── helpers.js        # Invoice generator, pagination helpers
├── .env.example
├── .gitignore
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database URL and secrets

# Push database schema
npx prisma db push

# Generate Prisma client
npx prisma generate

# Seed demo data
npm run db:seed

# Start development server
npm run dev
```

The server will start at `http://localhost:5000`.

### Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm run dev` | `node --watch src/server.js` | Start dev server with auto-reload |
| `npm start` | `node src/server.js` | Start production server |
| `npm run db:generate` | `npx prisma generate` | Generate Prisma client |
| `npm run db:push` | `npx prisma db push` | Push schema to database |
| `npm run db:migrate` | `npx prisma migrate dev` | Run database migrations |
| `npm run db:seed` | `node prisma/seed.js` | Seed demo data |
| `npm run db:studio` | `npx prisma studio` | Open Prisma Studio GUI |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | — |
| `JWT_SECRET` | Secret for access tokens | — |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens | — |
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment | `development` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:5173` |

## Multi-Tenancy

Every pharmacy registers as a **Tenant**. All data (users, medicines, sales, etc.) is scoped to a tenant via `tenantId`. The JWT token contains `{ userId, tenantId, role }`, and every database query automatically filters by `tenantId` — ensuring complete data isolation between pharmacies.

## Roles & Permissions

Three roles with different access levels:

| Action | ADMIN | PHARMACIST | CASHIER |
|--------|:-----:|:----------:|:-------:|
| View Dashboard | Yes | Yes | Yes |
| Manage Medicines | CRUD | CRUD | Read-only |
| Manage Inventory | CRUD | CRUD | Read-only |
| POS / Create Sales | Yes | No | Yes |
| View Sales History | Yes | Read-only | Yes |
| Manage Purchases | Yes | Yes | No |
| Manage Suppliers | Yes | Yes | No |
| View Reports | Yes | Read-only | No |
| System Settings | Yes | No | No |
| Delete Medicines/Suppliers | Yes | No | No |
| Refund Sales | Yes | No | No |
| Manage Users | Yes | No | No |

## API Endpoints

### Authentication
```
POST   /api/auth/register          Register new pharmacy + admin user
POST   /api/auth/login             Login (returns access + refresh tokens)
POST   /api/auth/refresh-token     Refresh access token
GET    /api/auth/me                Get current user profile
```

### Medicines
```
GET    /api/medicines              List medicines (paginated, filterable)
GET    /api/medicines/:id          Get medicine details with batches
POST   /api/medicines              Create medicine (Admin, Pharmacist)
PUT    /api/medicines/:id          Update medicine (Admin, Pharmacist)
DELETE /api/medicines/:id          Soft-delete medicine (Admin only)
POST   /api/medicines/:id/batches  Add batch to medicine (Admin, Pharmacist)
```

### Categories
```
GET    /api/categories             List categories
POST   /api/categories             Create category (Admin, Pharmacist)
```

### Sales
```
POST   /api/sales                  Create sale (auto-deducts stock)
GET    /api/sales                  List sales (paginated)
GET    /api/sales/:id              Get sale details with items
POST   /api/sales/:id/refund       Refund sale (Admin only)
```

### Purchases
```
POST   /api/purchases              Create purchase order (Admin, Pharmacist)
GET    /api/purchases               List purchases (paginated)
GET    /api/purchases/:id          Get purchase details
PUT    /api/purchases/:id/receive  Mark as received + update stock (Admin, Pharmacist)
```

### Suppliers
```
GET    /api/suppliers              List suppliers (paginated)
GET    /api/suppliers/:id          Get supplier details
POST   /api/suppliers              Create supplier (Admin, Pharmacist)
PUT    /api/suppliers/:id          Update supplier (Admin, Pharmacist)
DELETE /api/suppliers/:id          Soft-delete supplier (Admin only)
```

### Dashboard
```
GET    /api/dashboard/stats        Overview stats (revenue, sales count, etc.)
GET    /api/dashboard/revenue      Revenue data (query: ?period=weekly|monthly)
GET    /api/dashboard/recent-sales Recent sales list
GET    /api/dashboard/alerts       Low stock & expiry alerts
```

### Reports
```
GET    /api/reports/sales-summary    Sales summary with date range
GET    /api/reports/top-selling      Top selling medicines
GET    /api/reports/inventory-health Inventory health overview
GET    /api/reports/expiry           Expiring medicines report
GET    /api/reports/profit           Profit & loss report
```

### Settings
```
PUT    /api/settings/pharmacy      Update pharmacy info (Admin only)
PUT    /api/settings/profile       Update own profile (any role)
GET    /api/settings/users         List team members
POST   /api/settings/users         Create team member (Admin only)
PUT    /api/settings/users/:id     Update team member (Admin only)
GET    /api/settings/customers     List customers
POST   /api/settings/customers     Create customer
```

### Health Check
```
GET    /api/health                 Server health status
```

## Database Models

12 models with tenant-scoped isolation:

- **Tenant** — Pharmacy registration (name, license, plan)
- **User** — Team members (email unique per tenant, role-based)
- **Category** — Medicine categories (unique per tenant)
- **Medicine** — Medicine catalog (with barcode, min stock, soft delete)
- **Batch** — Stock batches (quantity, cost/sell price, expiry date)
- **Customer** — Customer records
- **Sale** — Sales transactions (invoice, payment method, status)
- **SaleItem** — Individual items in a sale (linked to batch)
- **Purchase** — Purchase orders from suppliers
- **PurchaseItem** — Individual items in a purchase
- **Supplier** — Supplier directory (soft delete)

## Demo Credentials

After running `npm run db:seed`:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@demo.com | demo1234 |
| Pharmacist | pharmacist@demo.com | demo1234 |
| Cashier | cashier@demo.com | demo1234 |
