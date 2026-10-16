# Multi-tenancy plan (design only)

## 1. Current state (single-tenant per deployment)

| Area | Assumption today |
| --- | --- |
| **Settings** | `StoreSettings.id = "default"` (or restaurant-scoped row via `restaurantId`); one row per deployment. |
| **Restaurant context** | `RESTAURANT_ID` env (`backend/src/lib/restaurant-context.ts`) filters menu, orders, users, banners, testimonials. |
| **Branches** | `Branch` rows belong to one restaurant; branch switcher in admin. |
| **Auth** | JWT users belong to one `restaurantId`; roles are global enums. |
| **Uploads** | Media paths are not tenant-prefixed in all cases; one disk/S3 bucket per deployment. |
| **Sockets** | Socket.IO rooms are order-wide; no tenant namespace in connection handshake. |
| **ISR / metadata** | Next.js `generateMetadata()` fetches `/settings/public` from one API URL. |
| **Caches** | In-memory store refresh events; no cross-tenant cache keys. |
| **CI / seed** | `seed:demo` creates one restaurant UUID; second client = second deploy or manual DB. |

The schema already has a `Restaurant` model and `restaurantId` on most business tables, but **one API process still serves one restaurant** via env.

## 2. Options

### A) Shared database, `restaurantId` everywhere + subdomain routing

**How it works:** One Postgres, one API fleet, one Next app. Resolve tenant from host (`pizza.example.com` → `restaurantId`) or JWT claim; every query includes `where: { restaurantId }`.

| Pros | Cons |
| --- | --- |
| Lowest marginal cost per new client | Highest engineering risk (data leaks, cache bugs) |
| One deploy to patch | Migrations affect all tenants |
| Central billing / super-admin | Noisy-neighbor performance |
| | Custom domains + SSL automation |

**Migration effort:** Medium–high (4–8 weeks solo): tenant middleware, audit all Prisma calls, socket namespaces, upload prefixes, Settings no longer `id='default'`, signup/onboarding flow.

**Data isolation:** Logical only; one SQL bug exposes all tenants.

**Cost on small VPS:** One $20–40/mo VPS + managed Postgres until ~20–50 light tenants.

### B) One deployment per client (Docker / env script)

**How it works:** Template compose stack: Postgres (or schema), API, web, `RESTAURANT_ID`, `JWT_SECRET`, domain. Provision script clones env, runs migrate + seed.

| Pros | Cons |
| --- | --- |
| Strong isolation | N× hosting cost and ops |
| Matches current code | Slower onboarding (minutes → hours) |
| Per-client backups easy | Fleet upgrades painful without automation |
| No cross-tenant bugs | |

**Migration effort:** Low now (mostly ops scripts + docs); scale pain at ~10+ clients.

**Data isolation:** Physical (separate DB or schema).

**Cost:** ~$15–25/mo per client on small VPS, or shared host with separate DBs.

## 3. Recommendation (solo / small team, Pakistan restaurants)

**Start with B (deployment-per-client)** for the first 5–15 paying sites:

- Code already assumes one `RESTAURANT_ID` per process.
- Pakistani SMBs often want “their own server” or dedicated subdomain without trusting shared infra.
- You avoid a costly tenant-isolation audit before revenue.

**Evolve to A** when:

- You operate 15+ active tenants, or
- You need one admin to manage all restaurants, or
- Per-client VPS cost exceeds engineering time for shared SaaS.

### Step-by-step migration toward A (when ready)

1. **Tenant resolution middleware** — map host → `restaurantId`; reject unknown hosts.
2. **Remove `StoreSettings.id = 'default'`** — settings keyed by `restaurantId` only.
3. **Prisma guard** — wrapper or lint rule: every query must include `restaurantId` (except `Restaurant` / super-admin).
4. **Auth** — embed `restaurantId` in JWT; staff cannot switch tenant without super-admin.
5. **Uploads** — `/{restaurantId}/...` prefix; signed URLs scoped.
6. **Sockets** — connect with tenant id; rooms `tenant:{id}:orders`.
7. **Next.js** — dynamic metadata per host (middleware proxy to correct API base or single API with host header).
8. **Onboarding** — signup creates `Restaurant` + default settings + admin user (no manual seed).

### Prisma models that would change most

- `Restaurant` — add `slug`, `customDomain`, `plan`, `status`, `createdAt`.
- `StoreSettings` — drop fixed `id`; unique on `restaurantId` only.
- `User` — unique `(restaurantId, email)` instead of global email (or allow same email across tenants).
- `Order.orderNumber` — unique per `(restaurantId, orderNumber)` not global.
- New: `TenantDomain`, `Subscription` (optional), `SuperAdminUser` (optional separate table).

## 4. Super-admin panel (outline)

| Screen | Purpose |
| --- | --- |
| **Restaurants list** | Name, slug, domain, plan, status, created, last order_at |
| **Create restaurant** | Name, city, currency, admin email → provision settings + seed menu optional |
| **Restaurant detail** | Usage stats, feature flags, `inventoryAutoHideMenu`, force-close storefront |
| **Impersonate** | Issue short-lived staff JWT for support (audit log) |
| **Billing** (later) | Plan, MRR, payment status — manual for PK market initially |
| **Fleet health** | API version, migration version, failed jobs |

Access: separate auth (`SUPER_ADMIN` role or external IdP), not visible in normal admin nav.

---

*No schema or application code changes are included in this document.*
