# Accessories Store POS System - Production Backend API

High-performance, modular, production-ready Node.js + TypeScript + Express + TypeORM + PostgreSQL Backend designed to seamlessly power the **Accessories Store POS & Inventory Management System**.

---

## 🛠️ Technology Stack

* **Runtime:** Node.js (v18+)
* **Language:** TypeScript
* **Framework:** Express.js
* **Database:** PostgreSQL (via TypeORM ORM)
* **Authentication:** JWT (Access Token + Refresh Token with hashing) & BcryptJS
* **Validation:** Zod
* **Security:** Helmet, CORS, Rate Limiting, Environment Variable Guard
* **Logging:** Morgan
* **FileUploads:** Multer (Local Disk Storage + Provider Abstraction)

---

## 📁 Architecture & Module Structure

```text
backend/
├── src/
│   ├── app.ts                  # Express application setup & middleware registration
│   ├── server.ts               # Server bootstrap & database connection
│   ├── config/
│   │   ├── env.config.ts       # Centralized environment variable validation
│   │   └── data-source.ts      # TypeORM DataSource & Entity configuration
│   ├── common/
│   │   ├── exceptions/         # AppError custom exception class
│   │   ├── middleware/         # Auth guards, validation, error handler, multer upload
│   │   ├── types/              # Express Request type extensions
│   │   └── utils/              # JWT helpers & standardized response utilities
│   ├── db/
│   │   ├── migrations/         # TypeORM database migrations
│   │   └── seed.ts             # Initial database seed (3 Beni Suef branches & Admin user)
│   └── modules/
│       ├── auth/               # Login, refresh token, logout, profile
│       ├── users/              # User management & employee sales count tracking
│       ├── branches/           # Store branch locations & metadata
│       ├── categories/         # Product category classification
│       ├── products/           # Products, SKU, barcodes, pricing tiers & stock limits
│       ├── physical-items/     # Barcoded item instances & stock tracking
│       ├── customers/          # Customer CRM & purchase relationships
│       ├── invoices/           # Invoices, sales records, profit & payment methods
│       ├── fixed-expenses/     # Daily & monthly branch operating expenses
│       ├── compositions/       # Product bundles & composite packages
│       └── upload/             # File upload endpoint for images & receipts
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

---

## ⚡ Quick Start & Installation

### 1. Requirements
* Node.js v18+
* PostgreSQL server running locally or remotely

### 2. Environment Setup
Create a `.env` file in `backend/`:

```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=accessories_store

JWT_ACCESS_SECRET=access_token_secret_key_accessories_store_2026
JWT_REFRESH_SECRET=refresh_token_secret_key_accessories_store_2026
JWT_ACCESS_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=7d

CORS_ORIGIN=http://localhost:5173
```

### 3. Install Dependencies & Initialize Database
```bash
cd backend
npm install
```

### 4. Run Development Server
```bash
npm run dev
```

### 5. Build for Production
```bash
npm run build
npm start
```

---

## 🔌 API Endpoints Summary

### Authentication (`/api/v1/auth`)
* `POST /login` - User login (Returns Access & Refresh Tokens)
* `POST /refresh` - Refresh Access Token
* `POST /logout` - User logout
* `GET /me` - Get current authenticated user details

### Users (`/api/v1/users`)
* `GET /` - List all users
* `GET /:id` - Get user by ID
* `POST /` - Create new user (Admin only)
* `PATCH /:id` - Update user details
* `DELETE /:id` - Delete user (Admin only)

### Branches (`/api/v1/branches`)
* `GET /` - List all branches (Includes Beni Suef main branches)
* `GET /:id` - Get branch details
* `POST /` - Add new branch
* `PATCH /:id` - Update branch details
* `DELETE /:id` - Remove branch

### Products (`/api/v1/products`)
* `GET /` - List all products
* `GET /:id` - Get product details
* `GET /branch-data/all` - List all branch pricing & stock data
* `GET /branch-data/:productId/:branchId` - Get product pricing data for specific branch
* `POST /` - Create product
* `POST /branch-data` - Set/Update multi-tier pricing for branch
* `POST /adjust-stock` - Adjust stock physical items quantity
* `PATCH /:id` - Update product metadata
* `DELETE /:id` - Delete product

### Physical Items / Barcodes (`/api/v1/physical-items`)
* `GET /` - List physical items
* `GET /product/:productId` - Physical items for product
* `GET /branch/:branchId` - Physical items for branch
* `POST /generate` - Generate new barcoded physical items
* `PATCH /:id/status` - Update item status (`available`, `sold`, `reserved`, `damaged`, `lost`)

### Invoices (`/api/v1/invoices`)
* `GET /` - List all invoices
* `GET /branch/:branchId` - List branch invoices
* `POST /` - Create sales invoice (Auto-updates item status to `sold` and increments employee sales)
* `POST /delete-many` - Batch delete invoices

### Customers (`/api/v1/customers`)
* `GET /` - List customer CRM records
* `POST /` - Create or update customer profile
* `DELETE /:idOrPhone` - Delete customer

### Fixed Expenses (`/api/v1/fixed-expenses`)
* `GET /branch/:branchId` - List fixed expenses for branch
* `POST /` - Add fixed expense (daily/monthly)
* `DELETE /:id` - Delete expense record

### Compositions / Bundles (`/api/v1/compositions`)
* `GET /branch/:branchId` - List product compositions for branch
* `POST /` - Create composite package/bundle
* `DELETE /:id` - Delete composite package

### Uploads (`/api/v1/upload`)
* `POST /single` - Upload image file
