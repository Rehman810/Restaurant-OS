# Multi-tenant operations (small VPS)

Target: one ARM-friendly VPS, Postgres + Node processes (no Kubernetes).

## Postgres roles

| Role | Purpose |
| --- | --- |
| Owner / migration user | `DATABASE_URL` for `prisma migrate deploy` (superuser or owner; bypasses RLS) |
| `restaurant_app` | Optional app role with `NOBYPASSRLS`; policies on `app.tenant_id` (see migration `row_level_security`) |

The API currently uses the migration user in most deployments; tenant safety is the Prisma extension + `tenancy:check`. Use `restaurant_app` when you can pin `set_config` per connection.

## Processes

| Service | Command | Port |
| --- | --- | --- |
| API | `cd backend && npm run start` | 4000 |
| Tenant web | `cd frontend && npm run start` | 3000 |
| Platform | `cd platform && npm run start` | 3100 |

Use **pm2** or **systemd** with restart on failure. Run schedulers only once per API instance (billing, lifecycle, usage rollup, dine-in, analytics email).

## Reverse proxy (Caddy recommended)

- **Wildcard tenant hosts:** `*.yourbrand.com` → frontend (3000).
- **Platform host:** `platform.yourbrand.com` → platform app (3100).
- **API:** internal `localhost:4000` or `api.yourbrand.com` → backend.

For **custom domains**, use on-demand TLS with an `ask` endpoint that returns 200 only for verified `TenantDomain` rows (protect with a shared secret). Confirm current Caddy on-demand TLS docs before production.

Tenant browsers hit the **storefront host**; Next.js proxies to the API with `TENANT_PROXY_SECRET` + forwarded host (see `frontend` proxy route).

## Required environment (names only)

**API (`backend/.env`):**

- `DATABASE_URL`
- `JWT_SECRET` (tenant staff, 32+ chars)
- `PLATFORM_JWT_SECRET` (platform panel)
- `CLIENT_URL` (comma-separated origins: tenant web, platform web)
- `SINGLE_TENANT_MODE=false` in production SaaS
- `TENANT_PROXY_SECRET`, `TRUST_FORWARDED_HOST` (when using Next proxy)
- `RESTAURANT_ID` only for local single-tenant dev
- Billing / lifecycle: `PLATFORM_BILLING_INTERVAL_MS`, `TENANT_CANCEL_RETENTION_DAYS`, `USAGE_ROLLUP_INTERVAL_MS`, etc. (see `backend/.env.example`)

**Tenant frontend:** `API_PROXY_TARGET`, optional `NEXT_PUBLIC_SOCKET_URL`

**Platform frontend:** `API_PROXY_TARGET`

## Backups

- Nightly **`pg_dump`** of the whole database (platform + all tenants).
- Per-tenant logical export: `npm run tenant:export` before major changes or offboarding.
- Test restore quarterly on a copy (`CREATE DATABASE … TEMPLATE` or restore dump to staging).

## Connection pool

On a small instance, keep Prisma pool modest (e.g. 5–10 connections per API process). One API worker is usually enough at low scale.

## Deploy checklist

1. `git pull`, `npm install`, `npm run build` in `backend`, `frontend`, `platform`.
2. `cd backend && npx prisma migrate deploy`
3. `npm run tenancy:check` and `npm test` on CI before promote.
4. Restart API → web → platform.
5. Smoke: `GET /health`, `GET /platform/auth/csrf` (with session), tenant host `/settings/public`.

## Do not

- Run `prisma migrate` against production without a rehearsal copy and backup.
- Enable `NEXT_PUBLIC_ENABLE_DEMO_LOGIN` in production.
- Rely on demo seed for platform admins in production — use `platform:create-admin`.
