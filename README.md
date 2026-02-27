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

