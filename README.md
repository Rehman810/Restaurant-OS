# Restaurant OS

White-label ordering storefront and kitchen admin. Restaurant name, city, currency, hours, and contact details come from Settings or the demo seed — not from the code.

## Onboard a restaurant (about 10 minutes)

1. Install Node.js 18+ and Docker.
2. From the repo root:

```bash
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

3. Set `JWT_SECRET` in `backend/.env` to a random string of at least 32 characters.
4. Start Postgres, migrate, and seed:

```bash
docker compose up -d
npm run prisma:migrate
npm run seed:demo -- --name "Pizza Hub" --city "Lahore" --currency PKR --timezone Asia/Karachi
```

The seeded admin is `admin@admin.com` with a random password printed once (or set `SEED_ADMIN_PASSWORD` for local dev). Re-running `seed:demo` does **not** reset passwords or overwrite existing store settings.

5. Start the app:

```bash
npm run dev:backend
npm run dev:frontend
```

API: http://localhost:4000  
Storefront: http://localhost:3000  
Staff sign-in: http://localhost:3000/admin/login  
Customer sign-in: http://localhost:3000/login

6. Sign in as admin and open **Settings**. Set the phone, address, logo, colors, currency, and hours. The storefront title, footer, and receipts follow those values without a redeploy.

### Multi-tenant SaaS mode

Production uses **shared Postgres** and resolves the tenant from the **hostname** (plus optional custom domains). Set `SINGLE_TENANT_MODE=false` and do not rely on `RESTAURANT_ID` in production.

| Mode | When | Tenant selection |
| --- | --- | --- |
| Multi-tenant (default for SaaS) | `SINGLE_TENANT_MODE=false` | Host / `TenantDomain` / slug |
| Single-tenant dev | `SINGLE_TENANT_MODE=true` | `RESTAURANT_ID` or tenant #1 |

Docs: [docs/MULTI_TENANCY.md](docs/MULTI_TENANCY.md), [docs/PLATFORM_PANEL.md](docs/PLATFORM_PANEL.md), [docs/OPS_MULTI_TENANT.md](docs/OPS_MULTI_TENANT.md).

**Platform panel:** `npm run dev:platform` → http://localhost:3100 (API on :4000). Create operators with `npm run platform:create-admin -w restaurant-os-api` (see `docs/PLATFORM_PANEL.md`).

**Two tenants locally:** `npm run tenancy:local-dev -w restaurant-os-api` then open `http://main.localhost:3000` and `http://<slug>.localhost:3000` — [docs/LOCAL_MULTI_TENANT.md](docs/LOCAL_MULTI_TENANT.md).

## Stack

- Frontend: Next.js 14, TypeScript, Tailwind
- Backend: Express, TypeScript
- Database: PostgreSQL, Prisma

## Scripts

```bash
npm run dev          # Docker, migrate, seed, API, and web
npm run test:db:up   # Postgres for integration tests (port 5433)
cp backend/env.test.example backend/.env.test
npm test             # migrate test DB + backend Vitest
npm run typecheck    # API build + frontend + platform tsc
npm run dev:platform # Platform operator UI (:3100)
```

Backend ops CLIs (`TENANT_ID`, `PLATFORM_ADMIN_*`): `tenancy:check`, `tenancy:backfill-verify`, `tenant:export`, `tenant:delete-dry-run`, `platform:create-admin`, `platform:reset-access` — see [docs/PLATFORM_PANEL.md](docs/PLATFORM_PANEL.md).

**Production API start** (no demo seed): `cd backend && npm run start` → `prisma migrate deploy` then `index.ts`. Run `npm run seed:demo` only on empty dev DBs (`ALLOW_DEMO_SEED=true` required if `NODE_ENV=production`).

### Deploy (single VPS checklist)

1. Set `DATABASE_URL`, `JWT_SECRET`, `PLATFORM_JWT_SECRET`, `CLIENT_URL` (tenant + platform origins), `SINGLE_TENANT_MODE=false`.
2. `npm run start` in `backend/`; build and start `frontend` and `platform`.
3. `npm run platform:create-admin -w restaurant-os-api` for the first operator (not demo seed in production).
4. Caddy/nginx: wildcard tenant hosts → frontend; `platform.*` → platform app; proxy API with tenant host headers — [docs/OPS_MULTI_TENANT.md](docs/OPS_MULTI_TENANT.md).
5. Never enable `NEXT_PUBLIC_ENABLE_DEMO_LOGIN` in production.

### Vercel frontend + remote API

If the Next.js app is on Vercel and the API runs elsewhere (Render, Oracle, etc.):

1. **Do not** set `NEXT_PUBLIC_API_URL` to `localhost` on Vercel.
2. Set **`API_PROXY_TARGET`** (Vercel server env) to your public API origin, e.g. `http://YOUR_HOST:4000` or `https://api.example.com`.
3. Set **`CLIENT_URL`** on the API to your Vercel URL (and enable `ALLOW_VERCEL_PREVIEWS=1` if you use preview deploys).
4. Redeploy **both** after pulling latest `main`. Check `https://YOUR_VERCEL_APP/api/proxy/health` — it should include `"apiVersion": 2`. If admin pages show **Not found**, the API is outdated or the proxy target is wrong.
5. Optional: **`NEXT_PUBLIC_SOCKET_URL`** → same host as the API for live orders and notifications.

### E2E (Playwright)

```bash
# Terminal 1–2: API + web with seeded DB
npm run dev

# Terminal 3: install browsers once
cd frontend && npx playwright install chromium

# Run smoke (skipped unless E2E_RUN=1)
E2E_RUN=1 E2E_BASE_URL=http://localhost:3000 npm run test:e2e -w restaurant-os-web
```

Optional dev login shortcuts: set `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=true` in `frontend/.env.local` (never in production).

Phase 2 feature notes and QA checklist: [docs/PHASE2.md](docs/PHASE2.md).  
Phase 3 (offline POS, reports, tax, storefront PWA): [docs/PHASE3.md](docs/PHASE3.md) and [docs/PHASE3_CHECKLIST.md](docs/PHASE3_CHECKLIST.md).

```bash
# Phase 3 e2e (API + web running, DB seeded)
cd frontend && E2E_RUN=1 npm run test:e2e -- e2e/phase3-storefront.spec.ts e2e/phase3-admin.spec.ts
```

Check dishes missing images:

```bash
npm run check:images -w restaurant-os-api
```

## Deploy notes

Backend CI is `.github/workflows/backend.yml`. Set `ORACLE_APP_DIR` to the directory on the server that contains this repo. Frontend deploys (Vercel) need `NEXT_PUBLIC_API_URL` pointing at the API. Do not commit `.env`.
