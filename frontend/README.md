<div align="center">

# 💻 NexPOS Frontend Application

**A blazing-fast, responsive Point of Sale (POS) and Inventory Dashboard built with React 19, TypeScript, Vite, Tailwind CSS, and a precision Thermal Sticker Label Engine.**

[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0+-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3.4+-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Radix UI](https://img.shields.io/badge/Radix_UI-Primitives-161618?style=for-the-badge&logo=radixui&logoColor=white)](https://www.radix-ui.com/)

[Key Highlights](#-key-frontend-engineering-highlights) • [Thermal Printer Engine](#-precision-thermal-sticker-printing-engine) • [Component Architecture](#-component--page-structure) • [State Management](#-reactive-state--offline-synchronization)

</div>

---

## 🎯 Overview

The **NexPOS Frontend** delivers a frictionless, keyboard-first cashier experience paired with a comprehensive inventory management back-office. Designed for rapid scanning, instant invoice settlements, multi-tier pricing, and direct industrial thermal label printing without third-party desktop drivers.

---

## ⚡ Key Frontend Engineering Highlights

### 1. 🏎️ Keyboard-First & Scanner-Optimized POS
* **Hardware Barcode Scanner Support:** Built-in scanner listeners that automatically capture rapid serial inputs, play audio confirmation feedback, and instantly push items to the cart.
* **Instant Calculation Pipeline:** Dynamic recalculation of subtotals, custom discounts (percentage or fixed amount), profit margins, and remaining deferred debt across multiple payment methods (Cash, Card, Vodafone Cash, InstaPay).

### 2. 🏷️ Precision Thermal Sticker Printing Engine
* Specially engineered for standard jewelry and mobile accessory sticker rolls (**38mm × 28mm Portrait**).
* Uses an isolated invisible `<iframe>` sandbox with strict `@page` CSS:
  ```css
  @page {
    size: 38mm 28mm portrait;
    margin: 0 !important;
  }
  ```
* **Elimination of Page Spillover:** Removes all default browser margin artifacts (URLs, headers, timestamps) and constrains element heights, ensuring each label prints strictly on **one single physical sticker**.
* **Clean 4-Element Vertical Stack:**
  1. **Top:** Centered High-Density SVG QR Code.
  2. **Middle-Top:** Product Name in Arabic/English.
  3. **Middle-Bottom:** Unique Product SKU / Serial Number.
  4. **Bottom:** Raw Price Level 4 numerical value (e.g., `150`).
* **Hardware TSPL Emulation:** Includes a native **TSPL command generator** for direct raw socket transmission to printers such as Xprinter XP-246B.

### 3. 🔄 Reactive State & Offline Synchronization
* **Local Store (`store.ts`):** Reactive singleton store backed by browser `LocalStorage`.
* **Optimistic UI Updates:** Instant user feedback on checkout or price edits, followed by background synchronization to the backend.
* **Dual-Layer Fallback:** If the primary Express API gateway is temporarily unreachable, the frontend seamlessly routes read/write operations to direct Cloud Database REST endpoints, guaranteeing zero POS lane downtime.

### 4. 🌐 RTL & Responsive Design
* Native Right-to-Left (RTL) Arabic typography and layout powered by custom Tailwind CSS utilities.
* Fully adaptable to desktop POS terminals, tablets (iPad/Android), and mobile handhelds.

---

## 📂 Component & Page Structure

```text
frontend/src/
├── components/
│   ├── layout/                        # Sidebar, Header, Branch Selector & Layout wrapper
│   └── ui/                            # Accessible Shadcn/Radix UI primitives
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── input.tsx
│       └── CustomSelect.tsx
│
├── pages/
│   ├── pos/                           # Main Cashier Terminal (Cart, Scanner, Checkout)
│   ├── products/                      # Product Catalogue, Restock, Edit, Label Printing
│   ├── invoices/                      # Invoices Timeline, Daily/Monthly Calendar, Batch Delete
│   ├── qrcodes/                       # Bulk Barcode Label Generator & Multi-Print
│   ├── suppliers/                     # Supplier Ledger & Account Statements
│   ├── customers/                     # Customer Profiles & Debt Installment Settlement
│   ├── branches/                      # Retail Branch Administration & Multi-Location Stats
│   └── expenses/                      # Store Operating Expenses & Daily Cash Logs
│
├── services/
│   ├── api.ts                         # Dual-layer HTTP request & Cloud Database fallback client
│   ├── store.ts                       # Reactive local store, caching & event bus
│   └── printerService.ts              # TSPL label generator & Local Thermal Printer Agent client
│
├── types/                             # Strict TypeScript domain interfaces
├── App.tsx                            # React Router tree & Authentication guards
└── main.tsx                           # Application entry point
```

---

## 🖨️ Thermal Printing Engine In Action

```text
┌─────────────────────────────────┐
│          38mm x 28mm            │
│         PORTRAIT TICKET         │
│                                 │
│        ┌───────────────┐        │
│        │  [ QR CODE ]  │        │  ← 1. Centered QR Code
│        └───────────────┘        │
│         جراب حماية سيليكون       │  ← 2. Product Name
│            CAS-49201            │  ← 3. Serial / SKU
│               150               │  ← 4. Raw Level-4 Price
└─────────────────────────────────┘
```

The thermal printing engine runs entirely in client-side TypeScript without requiring native printer drivers or third-party paid software.

---

## 🛠️ Installation & Development

```bash
# 1. Install dependencies
npm install

# 2. Start Vite development server
npm run dev

# 3. Build optimized production bundle
npm run build

# 4. Preview production build locally
npm run preview
```

---

## 🔒 Security & Privacy Notice

All client-specific customer contacts, real retail prices, and confidential store identifiers have been sanitized from this portfolio release. The application includes a self-contained demonstration dataset for code review and architectural evaluation.
