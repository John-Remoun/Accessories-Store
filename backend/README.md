<div align="center">

# ⚙️ NexPOS Backend API Engine

**A robust, modular, concurrency-safe Node.js & TypeScript REST API with real-time WebSocket state synchronization and ACID transaction guarantees.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.19+-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![TypeORM](https://img.shields.io/badge/TypeORM-0.3+-FE0803?style=for-the-badge&logo=typeorm&logoColor=white)](https://typeorm.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-Real--Time-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)

[Architecture](#-architecture--module-design) • [Concurrency & Locking](#-concurrency--race-condition-safety) • [Real-Time Sync](#-real-time-websocket-pipeline) • [API Reference](#-api-endpoints-reference) • [Database](#-database-schema--seeding)

</div>

---

## 📖 Overview

The **NexPOS Backend API** serves as the transactional backbone of the POS system. It manages inventory allocations across multiple geographic branches, calculates profit margins and cost metrics, issues invoices, tracks customer balances, and broadcasts live inventory updates to all active cashier terminals.

---

## 🏛️ Architecture & Module Design

The codebase adheres to a modular domain-driven structure, enforcing strict separation of concerns between HTTP routes, request validation, business logic, and database persistence.

```text
backend/
├── src/
│   ├── app.ts                         # Express setup, middleware pipelines & CORS guards
│   ├── server.ts                      # HTTP & Socket.io server bootstrap
│   │
│   ├── config/
│   │   ├── env.config.ts              # Zod-validated environment configurations
│   │   └── data-source.ts             # TypeORM DataSource & pool connection
│   │
│   ├── common/
│   │   ├── exceptions/                # AppError domain exception handler
│   │   ├── middleware/                # JWT Auth, Role Guard, Zod Validator, Multer
│   │   ├── socket/                    # Socket.io broadcast engine & event emitters
│   │   └── utils/                     # JWT tokens, Bcrypt & standardized response helpers
│   │
│   ├── db/
│   │   ├── migrations/                # Database versioning migrations
│   │   ├── seed.ts                    # Idempotent branch & super admin seeds
│   │   └── reset-clean.ts             # Clean deployment reset utility
│   │
│   └── modules/                       # Domain Modules
│       ├── auth/                      # Authentication (JWT token lifecycle)
│       ├── users/                     # User management & employee sales tracking
│       ├── branches/                  # Retail branch locations & metadata
│       ├── categories/                # Hierarchical product taxonomy
│       ├── products/                  # Product catalogue & multi-tier pricing
│       ├── physical-items/            # Serialized/barcoded item tracking
│       ├── invoices/                  # Sales transactions, items & cascade deletion
│       ├── customers/                 # Customer CRM & credit balance management
│       ├── fixed-expenses/            # Operating expenditures
│       └── upload/                    # File & receipt upload handlers
│
├── tsconfig.json
└── package.json
```

---

## 🔒 Concurrency & Race-Condition Safety

In multi-terminal retail environments, cashiers frequently attempt to sell the exact same physical piece or final unit in stock simultaneously.

### The Locking Flow
1. **Isolated Transaction:** The invoice checkout process is wrapped inside an atomic `AppDataSource.transaction(async (trx) => { ... })`.
2. **Pessimistic Row Locking:**
   ```sql
   SELECT * FROM product_branch_data
   WHERE "productId" = $1 AND "branchId" = $2
   FOR UPDATE;
   ```
   This prevents concurrent workers from reading a stale quantity before the first worker's decrement completes.
3. **Atomic Conditional Update:**
   ```sql
   UPDATE product_branch_data
   SET quantity = quantity - $soldQty
   WHERE "productId" = $1 AND "branchId" = $2 AND quantity >= $soldQty
   RETURNING quantity;
   ```
4. **Instant Rejection on Zero Stock:** If the update returns 0 affected rows, the transaction aborts with a `409 Conflict: Out of Stock` exception, preventing negative quantities and double-sales.

---

## ⚡ Real-Time WebSocket Pipeline

Once a checkout transaction commits successfully to PostgreSQL, the backend immediately publishes an event through the **Socket.io** broadcast pipeline:

```typescript
// Broadcasts to all connected cashier stations and dashboards
broadcastStockUpdate({
  branchId: targetBranchId,
  invoiceNumber: formattedInvoice.invoiceNumber,
  items: updatedStockItems, // productId, newQuantity, isOutOfStock
});
```

Connected terminals listen to `stock:updated` and automatically decrement their local shelf counts and update UI badges in under **50 milliseconds**.

---

## 🧾 Atomic Invoicing & Cascade Deletion

To guarantee full relational integrity when invoices are deleted:
- Invoices can be matched and deleted by both **UUID / Custom ID** and **Human-Readable Invoice Number** (`invoiceNumber`).
- Line items in `invoice_items` are configured with `ON DELETE CASCADE`.
- Associated employee sales metrics (`salesCount`) are decremented safely without race conditions.
- Batch deletion handles hundreds of records in a single query:
  ```sql
  DELETE FROM invoices WHERE id = ANY($1) OR "invoiceNumber" = ANY($1);
  ```

---

## 📡 API Endpoints Reference

### Authentication (`/api/v1/auth`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/login` | Authenticate user & issue JWT tokens | Public |
| `POST` | `/refresh-token` | Renew expired access token | Public |
| `GET` | `/me` | Retrieve authenticated user profile | Bearer Token |

### Products & Inventory (`/api/v1/products`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Fetch all products with branch pricing | Optional |
| `GET` | `/:id` | Fetch product details by ID | Optional |
| `POST` | `/` | Create new product with pricing tiers | Admin |
| `PUT` | `/:id` | Update product metadata & pricing | Admin |
| `DELETE` | `/:id` | Delete product and associated items | Admin |
| `POST` | `/:id/restock` | Increment stock allocation for a branch | Authenticated |

### Invoices & Sales (`/api/v1/invoices`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Fetch all invoices (paginated / filtered) | Authenticated |
| `GET` | `/branch/:branchId` | Fetch invoices for specific branch | Authenticated |
| `POST` | `/` | **Create invoice (Atomic Concurrency Safe)** | Authenticated |
| `POST` | `/delete-many` | **Batch delete invoices by IDs or Numbers** | Admin |
| `PATCH`| `/:id/pay` | Settle remaining balance for an invoice | Authenticated |
| `POST` | `/pay-customer-debt`| Settle customer outstanding balance | Authenticated |

### Branches & CRM (`/api/v1/branches`, `/api/v1/customers`)
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/branches` | List all active retail branches | Public |
| `GET` | `/customers` | List customers with contact & debt info | Authenticated |
| `POST` | `/customers` | Upsert customer record | Authenticated |

---

## 🗄️ Database Schema & Seeding

### Seeding Idempotency
Run the automated seed script to populate essential store branches and super admin roles:
```bash
npm run seed
```

### Clean Handover Reset Utility
To flush all test invoices, test customers, and demo data while preserving the core super administrator accounts:
```bash
npx ts-node src/db/reset-clean.ts
```

---

## 🛠️ Local Development & Running Tests

```bash
# 1. Install dependencies
npm install

# 2. Build TypeScript to JavaScript
npm run build

# 3. Start development server with hot-reload
npm run dev

# 4. Run automated concurrency test suite
npx ts-node src/test-concurrency.ts
```
