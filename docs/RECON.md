# Phase 1 — Recon

Snapshot of the repo before white-label and lifecycle work. Line numbers refer to the tree at the start of this change.

## Stack

| Layer | Choice |
| --- | --- |
| Monorepo | npm workspaces: `backend` (`ubaidfastfoodz-api`), `frontend` (`ubaidfastfoodz-web`) |
| Frontend | Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Zustand, Recharts, socket.io-client |
| Backend | Express 4 + TypeScript (`tsx`), Socket.IO, Helmet, express-rate-limit, Multer, Nodemailer, PDFKit |
| Database | PostgreSQL 16 (Docker Compose) |
| ORM | Prisma 5 (`backend/prisma/schema.prisma`) |
| Auth | JWT (`jsonwebtoken`) in `Authorization: Bearer`. Password hash via bcrypt. Optional TOTP (`backend/src/lib/totp.ts`). Roles: `CUSTOMER`, `ADMIN`, `CHEF`, `CASHIER`, `RIDER`. |
| Tests | None. `backend` scripts `test:email` and `test:whatsapp` are manual SMTP/WhatsApp probes, not a test runner. No ESLint config. Typecheck is `tsc` in each workspace. |

### How to run

```bash
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local   # if the example exists
docker compose up -d
npm run dev    # scripts/dev.js: migrate, seed, API :4000, Next :3000
```

Manual: `npm run db:up`, `npm run prisma:migrate`, `npm run prisma:seed`, `npm run dev:backend`, `npm run dev:frontend`.

Build: `npm run build -w ubaidfastfoodz-api` and `npm run build -w ubaidfastfoodz-web`.

There is no `npm test`. CI (`.github/workflows/backend.yml`) builds the API, migrates, and hits `/health`.

### Auth mechanism

- `POST /auth/login` issues a JWT (`backend/src/routes/auth.ts`, `signToken` in `backend/src/middleware/auth.ts`, 7-day expiry).
- `requireAuth` / `requireRole` guard admin routes. Inactive users are rejected.
- Fallback JWT secret in source is the string `ubaid-fast-foodz-demo-secret` (`auth.ts`, `middleware/auth.ts`, `lib/realtime.ts`, `lib/order-access.ts`). Production exits if that fallback or a secret shorter than 32 chars is used (`backend/src/index.ts`).
- Login UI (`frontend/src/app/login/LoginForm.tsx`) prefills `demo123` and demo emails outside production.
- Seed hashes the literal password `demo123` for every demo user (`backend/prisma/seed.ts`).
- Customer and staff share `/login`. Footer links “Staff login” to `/login` (`frontend/src/components/StoreFooter.tsx`).

### Order status model (current)

**Source of truth:** `backend/src/lib/order-machine.ts` (re-exported via `order-status.ts` on the server and `canTransition` in `frontend/src/lib/types.ts` on the client).

Prisma enum `OrderStatus` includes terminal statuses per fulfillment:

| Fulfillment | Flow |
| --- | --- |
| **DELIVERY** | `PENDING_CONFIRMATION` → `CONFIRMED` → `PREPARING` → `READY` → `OUT_FOR_DELIVERY` → `DELIVERED` |
| **PICKUP** | Same through `READY`, then `COLLECTED` |
| **DINE_IN** | Same through `READY`, then `SERVED` |

`CANCELLED` is allowed from any non-terminal status (one-way). Transitions are **exactly +1** along the flow (no skipping). `READY` and `OUT_FOR_DELIVERY` are distinct for delivery.

Kitchen UI (`frontend/src/app/admin/kitchen/page.tsx`) uses lanes `CONFIRMED`, `PREPARING`, `READY`. Live tracking kanban follows `STATUS_FLOW` in `frontend/src/lib/types.ts`, aligned with `canMoveForward` → `canTransition`.

`OrderEvent` rows are written on status changes. Online `POST /orders` starts at `PENDING_CONFIRMATION` or `CONFIRMED` when `autoConfirmOrders` is enabled.

**Tenant note:** `StoreSettings` is still keyed as `id = "default"` for the primary row, but business data is scoped by `restaurantId` and `RESTAURANT_ID` env. See `docs/MULTI_TENANCY_PLAN.md`.

### White-label checklist (onboarding a new restaurant)

1. Run `npm run seed:demo -- --name "…" --city "…" --currency PKR` or use Settings after first login.
2. Set **store name, tagline, phone, address, city**, logo, and **theme colors** in Admin → Settings.
3. Configure **hours**, **delivery areas**, and **minimum order**.
4. Upload **promo banners** or rely on generic carousel fallbacks.
5. Turn on **Show reviews section** only when you have real testimonials (Social tab).
6. Enable **inventory auto-hide menu** if recipes and stock are in use.
7. Set `JWT_SECRET`, `RESTAURANT_ID` (if not default), and production API URL on deploy.
8. Run `npm test` in `backend` before go-live.

## Hardcoded brand inventory

Disposition key:

- **config** — must be editable from Settings (or generated from settings/DB).
- **seed** — acceptable only as demo data produced by the seed for the chosen city/name.
- **delete** — remove from code, UI, and secrets.
- **rename** — identifier contains the old product name; rename to a generic package/service name.
- **false-positive** — matched `orders`, `Riders`, or similar; leave the word, do not treat as brand copy.

### `ubaid` / product name (must reach zero outside this file)

| File:line | Text | Disposition |
| --- | --- | --- |
| `package.json:2,5,9–15` | workspace name `ubaidfastfoodz`, description “Ubaid Fast Foodz” | rename |
| `backend/package.json:2` | `ubaidfastfoodz-api` | rename |
| `frontend/package.json:2` | `ubaidfastfoodz-web` | rename |
| `scripts/dev.js:29,42,51–52` | docker user/db `ubaid`, banner “Ubaid Fast Foodz”, workspace names | rename |
| `docker-compose.yml:4,7–9,13,15,21` | container, user, password, database, volume | rename |
| `render.yaml:3` | service `ubaidfastfoodz-api` | rename |
| `backend/src/middleware/auth.ts:6` | JWT fallback `ubaid-fast-foodz-demo-secret` | delete |
| `backend/src/routes/auth.ts:15` | same JWT fallback | delete |
| `backend/src/lib/realtime.ts:8` | same JWT fallback | delete |
| `backend/src/lib/order-access.ts:5` | same JWT fallback | delete |
| `backend/src/index.ts:38` | compares against that fallback | delete |
| `backend/prisma/fix-menu-images.ts:17` | `"Ubaid Zinger Burger"` | delete (script is one-off; dish name must not ship) |
| `README.md:1,41–43,91,101,103,131` | title, emails `@ubaidfastfoodz.com`, `UbaidFoodz`, `ubaidfoodz.onrender.com` | delete brand; deploy host becomes a placeholder |
| `.github/workflows/keep-render-awake.yml:17` | `https://ubaidfoodz.onrender.com` | rename to env-only URL |
| `.github/workflows/backend.yml:36,40,46,122` | database `ubaid_ci`, path `UbaidFoodz` | rename CI db; path is an example secret value — genericise the comment |

### `Your Restaurant`

| File:line | Disposition |
| --- | --- |
| `backend/prisma/schema.prisma:137` default `storeName` | config — empty/placeholder must not be the production display name; onboarding requires a real name |
| `backend/prisma/migrations/20240929000000_store_branding_email_toggles/migration.sql:2` | historical migration default; new migration may backfill, do not rewrite applied SQL unless the migration has not shipped. Treat as seed/default only |
| `backend/src/routes/settings.ts:73` | delete fallback that writes “Your Restaurant” when the name is cleared |
| `backend/src/lib/email.ts:52` | config |
| `backend/src/lib/branding.ts:5` | config |
| `frontend/src/lib/branding.ts:3` | config |
| `frontend/src/app/admin/settings/page.tsx:183` placeholder | config (placeholder only, not a saved default) |

### `Devsora`

| File:line | Disposition |
| --- | --- |
| `frontend/src/components/PoweredByDevsora.tsx:8,11,16,40,47` | config — optional “Powered by” text and URL, hidden when disabled |
| `frontend/src/components/StoreFooter.tsx:6,131` | config |
| `frontend/src/app/admin/layout.tsx:24,251` | config |
| `backend/src/lib/branding.ts:8` `DEVSORA_URL` | config |
| `backend/src/lib/email-templates.ts:2,89,142,161` | config |

### Phone `0321-5556677` / `5556677` / WhatsApp `923215556677`

| File:line | Disposition |
| --- | --- |
| `backend/prisma/schema.prisma:139–141` | delete as code defaults; seed may set a generated demo phone |
| `backend/prisma/migrations/20240924100000_store_features/migration.sql:27–29` | historical default; leave migration file, override via seed/settings |
| `frontend/src/components/StoreFooter.tsx:13` | config |
| `frontend/src/components/home/HomeDelivery.tsx:98` | config |
| `backend/prisma/seed.ts:451` | seed |
| `backend/.env.example:31` `WHATSAPP_NOTIFY_TO` | out of scope to build messaging; example value should not be a real demo number. Leave WhatsApp code paths untouched |

### Address / Karachi / Clifton / Boat Basin

| File:line | Disposition |
| --- | --- |
| `backend/prisma/schema.prisma:141` address default | delete hardcoded address |
| `backend/prisma/migrations/20240924100000_store_features/migration.sql:29` | historical default |
| `frontend/src/components/home/Faq.tsx:17` “across Karachi” area list | config — city + enabled area count |
| `frontend/src/components/home/Faq.tsx:9` “30–45 minutes” | config — `deliveryEstimateMin` |
| `frontend/src/components/home/Marquee.tsx:2` “Karachi Biryani” | seed dish name or generic marquee from menu |
| `frontend/src/components/home/HomeDelivery.tsx:15,48` “Karachi-wide”, “Across Karachi” | config — city name |
| `frontend/src/components/home/HomeDelivery.tsx:90` inline `Rs ` | config — `formatMoney` |
| `frontend/src/components/home/HowItWorks.tsx:17` “Cash on delivery across Karachi” | config — enabled payment methods + city |
| `frontend/src/components/home/HeroCarousel.tsx:91` fallback `"Karachi"` | config — hours label or city |
| `frontend/src/components/home/HeroCarousel.tsx:102` `"4.8 rating"` | delete hardcoded stat (see testimonials) |
| `frontend/src/components/home/Reviews.tsx:20,27,57–60,68` Karachi/Clifton copy, `4.8`, `2,400+ orders` | delete fallback; show DB reviews or nothing |
| `frontend/src/components/FulfillmentModal.tsx:139,161,207` “Where in Karachi?”, Clifton placeholder | config — city |
| `frontend/src/app/login/LoginForm.tsx:125` “across Karachi” | delete |
| `frontend/src/app/admin/areas/page.tsx:110` “Karachi areas” | config — “Delivery areas” |
| `frontend/src/app/admin/settings/page.tsx:380` “Times are in Karachi (PKT).” | config — timezone from settings |
| `frontend/src/components/admin/OpeningHoursEditor.tsx:116` `Asia/Karachi` | config |
| `frontend/src/components/admin/MenuFormSheet.tsx:253` placeholder “Karachi Chicken Biryani” | delete brand example |
| `frontend/src/lib/use-store-open.ts:7` comment | config — timezone setting |
| `frontend/src/lib/store-hours.ts:31–33,68` `getKarachiMinutes` / `Asia/Karachi` | config |
| `backend/src/lib/store-settings.ts:3–5,31` same | config |
| `backend/src/lib/karachi-areas.ts` entire list including Clifton, Boat Basin, “Bahria Town Karachi”, New Karachi sectors | seed — only when `--city` asks for that pack, not a global default |
| `backend/prisma/seed.ts:9–11,136,334–345,423–424,629–711` Karachi areas, “Karachi Chicken Biryani”, Karachi street addresses | seed, driven by `--city` |
| `backend/prisma/fix-menu-images.ts:27` “Karachi Chicken Biryani” | delete with the one-off script or make names generic |

### `demo123` / `demo.restaurant`

| File:line | Disposition |
| --- | --- |
| `frontend/src/app/login/LoginForm.tsx:14–36,50,219` | delete prefilled passwords and demo accounts on the public form |
| `frontend/src/components/admin/RiderFormSheet.tsx:124,143` | delete “demo123” placeholder |
| `frontend/src/app/admin/staff/page.tsx:257` placeholder `chef@demo.restaurant` | generic placeholder |
| `backend/src/routes/admin.ts:584` | delete `\|\| "demo123"` |
| `backend/src/routes/staff.ts:63` | delete `\|\| "demo123"` |
| `backend/prisma/seed.ts:352,359,439–475,756–760` | seed prints a random password once; emails may use a demo domain but must not hardcode `demo123` |
| `README.md:37–43` | delete published passwords |

### `PKR` / `Rs ` (currency)

Inline `Rs ` builders (replace with one `formatMoney()` that reads currency code + symbol from settings; default PKR / `Rs` and grouped integers):

- `frontend/src/lib/format.ts:1–3` `pkr()`
- `frontend/src/lib/print-receipt.ts:25–26`
- `backend/src/lib/email-templates.ts:35–36`
- `backend/src/lib/invoice.ts:11`
- `backend/src/routes/orders.ts:269`
- `frontend/src/components/home/HomeDelivery.tsx:90`
- `frontend/src/app/admin/page.tsx:118` sub label `"PKR"`
- `frontend/src/components/admin/DealFormSheet.tsx:182` “Deal price (PKR)”
- `frontend/src/components/admin/MenuFormSheet.tsx:272` “Price (PKR)”

`backend/src/lib/whatsapp.ts:47–48,156,168,195,205` also formats `Rs `. **Do not edit WhatsApp** in this project; currency there stays as-is until messaging work is in scope.

Call sites that import `pkr` (CartDrawer, DealCard, MenuItemCard, checkout, admin pages, POS, rider, receipts, etc.) are not brand strings. They must go through `formatMoney` so a non-PKR restaurant does not render `Rs`.

### False positives (ignore)

Grep hits on the words “orders”, “Riders”, “Customers”, “Burgers & Sandwiches”, and CSS class names are not restaurant identity. Examples: `schema.prisma` relation fields, `PipelineFlow.tsx`, `OrderDateFilter.tsx`, `privacy/page.tsx`, `category-meta.ts`.

## Hardcoded storefront stats and testimonials

| Location | What ships today | Disposition |
| --- | --- | --- |
| `frontend/src/components/home/Reviews.tsx:8–33` | Three fake reviews (Ayesha Khan / DHA, Hassan Raza / North Nazimabad, Sara Malik / Clifton) | delete. Replace with admin testimonials, hidden when empty |
| `Reviews.tsx:57–60` | If Google reviews are absent: rating **4.8** and **“2,400+ orders”** | delete. Optional live stats from real orders/ratings, hidden below a minimum count |
| `Reviews.tsx:68` | Eyebrow “Karachi speaks” | config or hide with the section |
| `frontend/src/components/home/HeroCarousel.tsx:102` | Trust pill **“4.8 rating”** | delete unless computed and above the minimum |
| `frontend/src/components/home/HomeDelivery.tsx` | “40+ areas” is not a literal in the current file; area coverage is implied by “Across Karachi” and the Karachi area seed (~200 names in `karachi-areas.ts`) | generate from enabled `DeliveryArea` count + city |
| `frontend/src/components/home/Faq.tsx:9` | “30–45 minutes” | `deliveryEstimateMin` (default 45) |
| `HowItWorks.tsx:17` | “Cash on delivery across Karachi” | payment-method toggles + city |
| `backend/src/lib/google-reviews.ts:18` | fallback object `rating: 4.8` used only when the Places call fails internally | do not surface as storefront copy |

Google reviews (`GET /settings/reviews`) may still render when a place id and API key exist. That path is real data, not a hardcoded testimonial.

## Checklist for Phase 2

1. Brand fields on settings: name, tagline, logo, colors, favicon, phone, address, city, lat/lng, timezone, currency code + symbol, social links, footer, optional powered-by.
2. Strip `ubaid` from code, meta, receipts, email, titles, README, package names, sidebar.
3. City, area count, ETA, payment methods, and currency from settings. One `formatMoney()`. Timezone from settings (default `Asia/Karachi`).
4. Remove fake reviews and the 4.8 / 2,400 stat. Hide when empty.
5. Remove footer “Staff login”. Dedicated staff sign-in route. Role redirect off `/login`.
6. Idempotent `seed:demo` with `--name`, `--city`, `--currency`, `--timezone`, random admin password printed once.
7. Demo dishes: matching image or initial placeholder. Script lists dishes with no image.
8. `restaurantId` on tenant data; queries scoped via one helper. One deployment = one restaurant is OK.
9. README: onboard a restaurant in under 10 minutes.
