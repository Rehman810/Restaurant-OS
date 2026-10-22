# Multi-tenancy runtime

Shared Postgres, one schema, `Restaurant` as tenant. Task 1 added row data and Prisma scoping. Task 2 adds how requests pick a tenant and how realtime, uploads, caches, and jobs stay isolated.

## Tenant resolution order

1. `SINGLE_TENANT_MODE=true` → `RESTAURANT_ID` or tenant #1.
2. Development only: `X-Tenant-Slug` → `Restaurant.slug`.
3. Trusted proxy: `X-Tenant-Host` when `X-Tenant-Proxy-Secret` matches `TENANT_PROXY_SECRET` (Next.js `/api/proxy`).
4. Optional: `X-Forwarded-Host` when `TRUST_FORWARDED_HOST=1`.
5. `TenantDomain.hostname`, then `Restaurant.hostname` or `Restaurant.slug`.
6. Localhost fallback per `SINGLE_TENANT_MODE` rules in `restaurant-context.ts`.

Unknown host → HTTP 404 `{ "error": "Not found." }`. Production never accepts a client-supplied tenant id in the body or query.

## Sessions and JWT

Staff JWTs include `rid` (restaurant id). Auth middleware requires the user’s `restaurantId` to match the resolved request tenant. Production cookies use the `__Host-` prefix (`__Host-ros_session`, `__Host-ros_csrf`).

## Socket.IO rooms

Rooms are prefixed: `t:{restaurantId}:ops`, `t:{restaurantId}:b:{branchId}`, `t:{restaurantId}:public`, plus rider, customer, user, and order rooms. Handshake resolves the tenant from headers the same way as HTTP.

## Uploads

New files live under `uploads/{restaurantId}/`. URLs are `/uploads/{restaurantId}/{file}`. Legacy flat paths redirect to tenant #1 when the file exists there.

## Background jobs

`forEachJobTenant` loads ACTIVE, TRIAL, and PAST_DUE tenants and runs work inside `runWithRestaurant` with a per-tenant Postgres advisory try-lock.

## Row-level security (process vs database role)

The app connects as a superuser in local Docker, so RLS is not enforced on normal Prisma queries. Enforcement in the API process is the Prisma extension plus `npm run tenancy:check`. RLS is installed for the `restaurant_app` role and is verified in tests with `SET LOCAL ROLE restaurant_app` inside a transaction.

Measured overhead on the test database (tenant #1, 115 orders): scoped `SELECT` vs owner `SELECT` — see `tenancy-rls.test.ts` logs in CI output.

## Platform billing (Task 3)

Global `Plan` rows define entitlements (`maxBranches`, `maxStaff`, `inventory`, `dineIn`, `pos`, `analytics`). Each tenant has one `Subscription`, manual `PlatformInvoice` rows, and `PlatformPayment` records (bank transfer, JazzCash, Easypaisa, cash, cheque — no card gateway). An in-process job (`runPlatformBillingJob`) rolls billing periods, opens invoices, and marks tenants past due. Tenants read a summary at `GET /admin/billing/summary`. Platform operators sign in at `/platform/auth/*` with a separate cookie and `PLATFORM_JWT_SECRET`. Roles: super admin, admin, billing, support, readonly. APIs under `/platform/tenants`, `/platform/plans`, `/platform/invoices`, and `/platform/audit-logs` use `basePrisma` and never tenant `User` rows. Manual payments: `POST /platform/invoices/:invoiceId/payments`.

## Provisioning, onboarding, support access (Task 6)

Platform operators with `tenants:write` can create a tenant in one transaction via `POST /platform/tenants` (`provisionTenant`: restaurant, settings, default branch, trialing subscription, optional hostname and owner user). Staff onboarding progress is exposed at `GET /admin/onboarding` (store name, branch, owner steps).

Support staff with `support:write` mint a one-time link via `POST /platform/tenants/:id/support-sessions`. The operator opens the tenant domain and exchanges the token at `POST /auth/support-exchange` for a short-lived Bearer JWT (`typ: support`). That session acts as tenant **ADMIN**, bypasses suspended read-only mode, and is audited on the platform side. Configure link lifetime with `SUPPORT_ACCESS_TTL_HOURS` (default 2).

## Tenant lifecycle (Task 5)

`TenantStatus` drives HTTP behavior after the tenant is resolved. **Suspended** stores allow staff sign-in and read-only admin (no writes). **Cancelled** stores block sign-in and ordering; after `TENANT_CANCEL_RETENTION_DAYS` (default 30) a background job sets **Archived**, clears the hostname, and host lookup returns 404. Hard data purge is not automated. Public settings include `storeAccess` (status, ordering flag, message). Platform status changes validate allowed transitions and set `deleteScheduledAt` when cancelling.

## Metrics, health, announcements (Task 7)

`TenantUsageDaily` stores per-tenant rollups (Karachi calendar days) using the same booked/collected definitions as the tenant dashboard (`aggregatePeriodOrderMetrics`). The `tenant_usage_rollup` job runs on a schedule (see `USAGE_ROLLUP_INTERVAL_MS`; set `USAGE_ROLLUP_FULL=1` once to backfill ~90 days).

Platform operators use `GET /platform/overview` (MRR/ARR, GMV, trials ending, at-risk tenants, top tenants, scheduler metadata) and `GET /platform/health`. Announcements and maintenance mode are managed under `/platform/announcements` and `/platform/settings` (versioned PATCH). Tenants see active banners via `GET /admin/announcements` and billing via `GET /admin/billing/*`. Maintenance blocks non-GET tenant API writes with HTTP 503.

## Isolation test suite (Task 9)

Blocking checks run on every `npm test` (includes `tenancy:check`) and in GitHub Actions:

| Area | Tests |
| --- | --- |
| Prisma extension | `tenancy-context.test.ts`, `tenancy-isolation.test.ts` |
| RLS (`restaurant_app`) | `tenancy-rls.test.ts` |
| Host / slug resolution | `tenancy-resolve.test.ts` |
| Cross-tenant HTTP | `isolation-cross-tenant.test.ts` (JWT `rid` vs `X-Tenant-Slug`, orders, public menu) |
| IDOR samples | `idor-scope.test.ts`, `isolation-walker.test.ts` |
| Job rollups | `isolation-jobs.test.ts` |
| Platform vs tenant auth | `platform-api.test.ts` |

Cross-tenant HTTP tests set `SINGLE_TENANT_MODE=false` and send `X-Tenant-Slug` (non-production only). Fixture helper: `test/helpers/isolation-fixture.ts`.

## Platform admin UI (Task 8)

The `platform/` workspace is a Next.js 14 app on port **3100** (`npm run dev:platform`). It proxies API calls through `/api/proxy` to `API_PROXY_TARGET` (default `http://127.0.0.1:4000`) so platform session cookies stay same-origin. Pages: sign-in, overview, tenants (list, create, detail), announcements, audit log, health, and settings.

## Operations (Task 10)

- [PLATFORM_PANEL.md](./PLATFORM_PANEL.md) — roles, lifecycle, billing, runbooks, CLI.
- [OPS_MULTI_TENANT.md](./OPS_MULTI_TENANT.md) — VPS, Caddy, backups, env names.

## Frontend

Server components call the API with `API_PROXY_TARGET` and `TENANT_PROXY_SECRET`. ISR tags include the storefront host: `tenant:{host}:settings-public`.
