# Deployment Guide

## Frontend (Vercel)
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist/client` (configurable)
- Env: `VITE_API_URL`

## Backend & Database (Render)
- Runtime: Node.js
- Start Command: `npm run start`
- Env: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`
