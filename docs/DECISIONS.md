# Decisions

## One deployment, scoped data

There is a `Restaurant` row. Menu, categories, areas, orders, users, deals, banners, blocks, testimonials, and settings store `restaurantId`.

The API resolves the id from `RESTAURANT_ID`, then from a matching `Restaurant.hostname`, then from the migration default `11111111-1111-4111-8111-111111111111`. `AsyncLocalStorage` holds that id for the request. Prisma queries on tenant models add `restaurantId` on reads and writes, and refuse updates or deletes for another restaurant's row.

`User.email`, category name, area name, and order number stay globally unique. That is simpler for login and existing lookups. Two restaurants in one database must not reuse those values. Listing and mutation still cannot see another restaurant's rows.

## Currency display

Money stays in `Decimal(10,2)`. `formatMoney()` converts through integer minor units and prints zero fraction digits for PKR (`Rs 1,234`) and two digits for other codes. The symbol and code come from settings.

WhatsApp message formatting is unchanged. Messaging providers are out of scope.

## Seed password

Demo seed (`npm run seed:demo`) is **manual only** — not run on production `start`. In production, `ALLOW_DEMO_SEED=true` is required. If `admin@admin.com` already exists, passwords and existing `StoreSettings` are not overwritten; inventory/coupon refresh may still run.

Karachi neighbourhoods are seeded only when `--city` is Karachi. Any other city gets a short generic area list.

## Docker database name

Compose uses user `restaurant` and database `restaurant_os`. An existing volume created with the old demo credentials must be recreated (`docker compose down -v`) before `docker compose up`.

## Testimonials

The storefront does not ship fake reviews or a hardcoded rating. Published testimonials from Settings are shown. Live order-count stats appear only when `showLiveStats` is on and there are at least 10 non-cancelled orders.

## Hours

Opening hours are a weekly schedule. A missing schedule still uses the old open/close pair for every day. An overnight slot (close earlier than open) stays open past midnight, including when the next day is marked closed, until that slot's end. The start minute is open and the end minute is closed. The storefront hours line is always built from the schedule. A custom closed message replaces only the banner sentence.

Tax and service charge default to 0. Exclusive charges are added to the order total. Inclusive charges are shown but not added again. Revenue continues to use `order.total`, which includes exclusive tax, service, and delivery.

## Sign-in

Failed password attempts on a real account lock it for 15 minutes after 8 failures. The error for a wrong password and a disabled account is the same. A locked account gets a separate "try again later" response. Sessions are JWTs for 7 days, also set as an `HttpOnly` `SameSite=Lax` cookie (`Secure` in production). `tokenVersion` on the user invalidates older tokens on "sign out everywhere", deactivation, and password change. Two-factor recovery codes are hashed and each code works once. The dashboard 2FA reminder can be dismissed for the browser session and returns on the next one.

CORS allows `CLIENT_URL` origins. Development also allows localhost. Vercel preview hosts are allowed only when `ALLOW_VERCEL_PREVIEWS=1`.

## Uploads

Images must match JPEG, PNG, GIF, or WebP bytes and are re-encoded with `sharp` before they are stored.

## Powered by

The storefront, admin sidebar, and emails always show “Powered by Devsora” linking to https://devsora.pro. Restaurant admins cannot hide or rename it. The old settings columns are ignored.

## Staff sign-in

Customers use `/login`. Staff use `/admin/login`. A signed-in non-customer who opens `/login` is sent to their role home.
