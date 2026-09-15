# Bina Enterprise - Modern Accounting & ERP System

A full-stack Enterprise Resource Planning (ERP), GST Billing, Invoicing, Inventory, Purchasing, Sales, Payments, Accounting Ledgers, and Multi-Location Financial Management System.

---

## Architecture (Two-Folder Structure)

```text
Bina-Enterprise/
├── frontend/                     # React 19 + Vite + Tailwind CSS + PWA (Deploy to Vercel)
│   ├── src/
│   │   ├── components/           # UI, forms, and navigation components
│   │   ├── contexts/             # AuthContext & BusinessContext
│   │   ├── pages/                # 14 Full ERP Pages
│   │   ├── lib/                  # API client & Firebase authentication
│   │   └── shared/               # Dynamic Indian Financial Year & Accounting Engine
│   ├── package.json
│   ├── vite.config.ts            # Development proxy to http://localhost:3000
│   └── vercel.json               # SPA routing
│
├── backend/                      # Express 5 + TypeScript + Drizzle ORM (Deploy to Render)
│   ├── src/
│   │   ├── db/                   # Database pool, schema, queries & migration
│   │   ├── server/               # Routes, middleware, controllers, excel exports
│   │   └── shared/               # Exact accounting mathematical engine
│   └── package.json
│
├── package.json                  # Root npm workspaces configuration
└── vercel.json                   # Root Vercel deployment configuration
```

---

## Quick Start

### 1. Installation
```bash
npm install
```

### 2. Local Development
```bash
# Terminal 1: Backend API (port 3000)
npm run dev:backend

# Terminal 2: Frontend Web App (port 5173)
npm run dev:frontend
```

Open [http://localhost:5173](http://localhost:5173) in your browser. All `/api` calls are automatically proxied to the backend.

### 3. Production Build
```bash
npm run build
```

---

## Deployment

- **Frontend**: Deploy `frontend` directory to [Vercel](https://vercel.com).
- **Backend**: Deploy `backend` directory to [Render](https://render.com).
- See [DEPLOYMENT.md](./DEPLOYMENT.md) for full deployment instructions and environment variables.
