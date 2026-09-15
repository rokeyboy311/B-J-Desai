# Bina Enterprise ERP - Deployment & Project Structure Guide

The repository is structured into two clean, self-contained directories:
- **`frontend/`**: React 19 + Vite 6 + Tailwind CSS 4 Single Page Application (PWA).
- **`backend/`**: Express 5 + TypeScript + Drizzle ORM + PostgreSQL API Server.

---

## 1. Local Development Workflow

### Option A: Run Both Workspaces from Root (Recommended)
```bash
# Install all dependencies for both workspaces
npm install

# Run frontend (http://localhost:5173)
npm run dev:frontend

# In a separate terminal, run backend (http://localhost:3000)
npm run dev:backend

# Or build both simultaneously
npm run build
```

During local development, the Vite dev server in `frontend` automatically proxies all `/api` requests to `http://localhost:3000`.

### Option B: Run Workspaces Independently

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

#### Backend
```bash
cd backend
npm install
npm run dev
```

---

## 2. Deploying Frontend to Vercel

1. Import the `Bina-Enterprise` repository in the [Vercel Dashboard](https://vercel.com/new).
2. **Project Settings**:
   - **Root Directory**: Select `frontend` (or leave default root, as `vercel.json` at root handles `--workspace=frontend`).
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist` (if Root Directory is `frontend`) or `frontend/dist` (if Root is root).
3. **Environment Variables**:
   - `VITE_API_URL`: URL of your Render backend (e.g. `https://bina-enterprise-backend.onrender.com`).
4. Click **Deploy**. SPA routing and deep links work out-of-the-box via `vercel.json`.

---

## 3. Deploying Backend to Render

1. Create a new **Web Service** on [Render Dashboard](https://dashboard.render.com).
2. Connect the `Bina-Enterprise` repository.
3. **Settings**:
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
4. **Environment Variables**:
   - `DATABASE_URL`: Hosted PostgreSQL connection string (Neon, Supabase, or Render Postgres).
   - `JWT_SECRET`: Random secure string for authentication tokens.
   - `NODE_ENV`: `production`
   - `PORT`: `3000` (or Render's default port 10000).
   - `CORS_ORIGIN`: Your deployed Vercel frontend URL (e.g. `https://bina-enterprise.vercel.app`), or leave empty to allow all origins.
5. Click **Create Web Service**.

---

## 4. MCP Servers Configuration

Configured in `.agents/mcp_config.json`:
- **Vercel MCP**: Connects to `https://mcp.vercel.com`
- **Render MCP**: Uses `npx render-mcp start` with `RENDER_API_KEY`
