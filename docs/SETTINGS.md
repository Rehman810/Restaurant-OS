# Admin settings

Restaurant-wide configuration for admins (and **My account** for managers). Routes live under `/admin/settings/[section]`. Source of truth for IA and field lists: `frontend/src/modules/settings/ia.ts` and `section-fields.ts` (mirrored on the API in `backend/src/lib/settings-section-fields.ts`).

## Who can access what

| Role | Settings UI |
|------|-------------|
| **ADMIN** | All 16 store sections + My account |
| **MANAGER** | **My account** only (PIN, password, 2FA, sessions) |
| **Other staff** | No settings routes (redirected from `/admin/settings/*`) |

Server PATCH handlers call `assertSettingsSectionAccess` so managers cannot update store fields via API.

## Save model

- **Section PATCH** — `PATCH /settings/sections/:sectionId` with `version` (optimistic lock on `settingsVersion`). Wrong version → **409** with server diff; UI offers reload or overwrite.
- **Sticky save bar** — Per-section dirty count; leave navigation prompts if unsaved.
- **Dangerous changes** — Some toggles (e.g. offline POS) require an extra confirmation before save.
- **History** — Admins can open **History** on form sections and restore a prior snapshot (audit-backed).
- **Storefront refresh** — After save, ISR sections trigger `POST /api/revalidate-store` for public pages.
- **Immediate APIs** — Banners and testimonials use dedicated endpoints (no save bar). My account uses auth/staff PIN endpoints.

## Section index

| Section | Save bar | Notes |
|---------|----------|--------|
| Branding and theme | Yes | Logo, colors, currency, timezone |
| Contact and social | Yes | Phone SoT, social links |
| Reviews and testimonials | Yes + instant testimonials | Google reviews via Integrations |
| Banners | No | `/settings/banners` |
| Hours and availability | Yes | Online vs kitchen hours |
| Orders and delivery | Yes | Checkout rules, not SLA (see Alert thresholds) |
| Tax and receipts | Yes | Checkout vs invoicing |
| Notifications | Yes | Email matrix by role |
| Integrations | Yes | Place ID; env status read-only |
| POS controls and approvals | Yes | PIN rules vs personal PIN |
| Devices and printing | Yes | Offline POS, print, PWA push |
| Inventory | Yes | Menu/stock toggles |
| Costing | Yes | Report thresholds |
| Alert thresholds | Yes | Late/stale dashboards |
| Scheduled reports | Yes | Analytics email |
| My account | No | Password, 2FA, PIN |

## Reviews and testimonials

- **Show reviews section** / **live order count** toggles control homepage blocks.
- **Testimonials** are CRUD via `/settings/testimonials` (immediate).
- **Google live reviews** need **Integrations** (Place ID + API key).

## Alert thresholds

- **Late confirmation / prep / delivery** — Used on dashboard, tracking, and dispatch (replaces duplicate SLA fields under Orders).
- **Stale orders**, **duplicate order window**, **tracking completed window**, **shift open warning**, **low rating** — Board and ops alerts.

## Scheduled reports

- **Analytics summary email** recipients and schedule (week start, insight thresholds) for automated admin emails.
- Uses SMTP from server env; test send from the section when configured.

## Performance

Settings UI is split per section component; the history drawer is lazy-loaded. Example production build sizes (`frontend`, `next build`):

| Route | First Load JS |
|-------|----------------|
| `/admin/settings` (mobile index) | ~120 kB |
| `/admin/settings/[section]` | ~164 kB |

Re-run the build after large UI changes to compare.

## Navigation and mobile

- **Desktop (lg+):** Left sidebar lists sections by group; search jumps to a section or field anchor.
- **Mobile:** Open **Settings** from the bottom tab (admin) or **My account** / **Settings** in the header account menu. The section list is role-filtered (managers only see **My account**).
- **Save bar:** Sits above the mobile tab bar when you have unsaved changes; on desktop it aligns with the main admin sidebar (including collapsed width).
- **Deep links:** Search and legacy `?tab=` URLs scroll to the target block (`scroll-mt` on sections).

## Hours and availability

- **Weekly schedule** defines kitchen hours. POS and dine-in follow this schedule (including special days). They are **not** affected by “Close online ordering”.
- **Close online ordering** (`forceClosed`) pauses web/app checkout only. Optional **reason**, **auto-reopen** time, and audit metadata (who/when) are stored on save.
- **Special days** override the weekly template for specific calendar dates (closed all day or custom slots).
- **Last order cutoff** stops online orders N minutes before the current slot’s kitchen close time.
- **Closed message** supports `{opensAt}` for the next opening phrase; otherwise a default message is generated from the effective schedule.

Branch-level hours are configured separately (see `docs/BRANCHES.md`); store settings hours apply to the default online storefront unless branch rules say otherwise.

## Orders and delivery

- **Minimum order** and **free delivery above** apply at checkout (validated so free-delivery threshold is not below minimum when both are set).
- **Delivery / takeaway estimates** are customer-facing ETAs on the site and checkout.
- **Late order timing** (confirmation, prep, delivery) lives only under **Alert thresholds**. Legacy `confirmSlaMinutes` / `deliverySlaMinutes` columns remain in the database as fallbacks and are mirrored when you save alert thresholds.

## Tax and receipts

- **Storefront charges** (`taxPercent`, service charge, “included in menu”) drive cart/checkout quotes.
- **Tax invoicing mode** enables order tax snapshots, `TAX-*` invoice numbers, and tax reports (see `docs/TAX_INVOICING_NOTES.md`).
- **Invoicing-only:** legal name/address, STRN, NTN, fiscal-year sequence, rounding rule, and optional per-fulfillment / per-payment rate overrides (payment overrides win).
- `pricesIncludeTax` applies to the invoicing engine; it can differ from checkout “tax included” when you need that.

## Integrations

- **Server env** (`backend/.env`): SMTP, VAPID keys, `GOOGLE_PLACES_API_KEY`, WhatsApp Cloud API credentials. The Integrations page shows configured / missing status (no secrets).
- **Google Place ID** is saved in settings and used with the Places API key for live homepage reviews.
- Restart the API after changing environment variables.

## Notifications

- **Email** toggles are per role (column switches on the matrix). Rows list each transactional email; staff roles only receive **New order** alerts besides account mail.
- **Customer** toggle controls the full order lifecycle (placed → cancelled).
- **Rider** toggle controls delivery-assignment email only.
- Password reset and staff invites always send to the recipient (not gated by these toggles).
- **In-app** bell and staff browser push use the ops feed; **customer PWA push** is under Devices and printing.

## Branding and theme

- **Primary / accent** colors drive CSS variables on the storefront and admin (`applyBrandTheme`). The editor shows WCAG contrast checks for buttons and text on white.
- Use **Darken primary for buttons** if white button labels fail the 3:1 large-text threshold.
- **Favicon** updates the browser tab icon when saved (live store refresh).
- Presets are shortcuts only — save to persist.

## Contact and social

- **Store settings** are the source of truth for phone, WhatsApp, address, coordinates, and social URLs on the public site, checkout pickup text, POS/KOT receipts, and tax invoices (address fallback).
- Phone/WhatsApp are normalized to **+92…** on save; the admin form previews normalization on blur.
- **City**, **footer tagline**, and logo live under Branding and theme. **Tax legal address** is under Tax and receipts. **Branch** phone/email override store contact for that branch only.

## Promo banners

- Banner CRUD uses `/settings/banners` and applies **immediately** (no section Save bar).
- **Show first** lowers `sortOrder` so the banner leads the homepage carousel. **Hide** keeps the row but removes it from rotation.

## Inventory and menu

- **Auto-hide menu** hides storefront dishes when a required ingredient is out of stock.
- **Deduct at preparing** (default on) posts inventory when an order enters Preparing; when off, deduction behavior follows the legacy order-placed path in the inventory module.
- **Allow negative** permits ledger balances below zero (use with care).
- Ingredient stock is managed under **Admin → Inventory**.

## Costing

- **Target** and **high** food cost % drive bands on the dish costing report and menu engineering views.
- **Suggested price rounding**, **suspicious low cost fraction**, and **ingredient price change alert %** feed reports and staff alerts.
- Save this section with the settings Save bar like other store fields.

## My account and security

- **Admins and managers** only. Other staff roles do not see store settings; managers are limited to this section.
- **Password** — `POST /auth/change-password` with current and new password (min 8 characters). Other sessions are invalidated; this browser gets a fresh session cookie.
- **Sessions** — sign out on this device, or **sign out everywhere** (`POST /auth/logout-all`, bumps `tokenVersion`).
- **Approval PIN** — personal PIN for POS approvals; store rules for when a PIN is required live under **POS controls and approvals**.
- **Two-factor** — TOTP for admin/manager login; recovery codes shown once at enable time.
- Legacy `?tab=security` redirects to **My account**.

## POS controls and approvals

- **Max cashier discount** — percent a cashier may apply without a manager PIN.
- **Approval toggles** — void, refund, and price override can each require a manager PIN (PINs are per user under My account).
- **Reason lists** — void, discount, and refund dropdowns at the POS (one reason per line).
- **Shift variance tolerance** — closing cash variance above this amount needs a manager note.
- **Rider cash stale hours** — dashboard COD alert threshold.

## Devices and printing

- **Order status push (PWA)** — customer opt-in on tracking; needs VAPID in server env (see Integrations).
- **Offline POS** — queue orders when offline; changing this may trigger a dangerous-change confirmation.
- **Clock skew threshold** — flags synced offline orders when device time is far from server time.
- **Auto-print kitchen tickets** — browser print on new confirmed orders from the kitchen board.

## Manual QA checklist

- [ ] **Admin:** Open each settings section from the sidebar; no console errors; headings match IA.
- [ ] **Admin:** Edit branding store name → save bar → **Save** → reload persists; **Discard** reverts.
- [ ] **Admin:** Two tabs: edit same section, save in tab A, save in tab B → conflict sheet with diff.
- [ ] **Admin:** Toggle offline POS → dangerous confirm → save → cashier offline queue respects flag.
- [ ] **Admin:** Hours — close online ordering with reason + optional reopen; storefront checkout blocked, POS still works.
- [ ] **Admin:** Notifications matrix column toggle updates all rows in that role column.
- [ ] **Admin:** Banner add/hide/delete applies without save bar; carousel updates on storefront.
- [ ] **Manager:** `/admin/settings/branding-theme` redirects away; **My account** loads PIN + password forms.
- [ ] **Mobile:** Settings index lists only allowed sections; save bar clears tab bar; back link returns to index.
- [ ] **Search:** “minimum order” opens Orders and delivery; legacy `?tab=hours` lands on hours section.

## Automated tests

| Layer | Path |
|-------|------|
| Frontend unit | `frontend/src/modules/settings/ia.test.ts`, `section-fields.test.ts`, `notification-matrix.test.ts` |
| Frontend e2e | `frontend/e2e/admin-settings.spec.ts` (`E2E_RUN=1`) |
| Backend unit | `backend/test/settings-sections.test.ts`, `settings-section-fields-parity.test.ts`, `settings-version-conflict.test.ts`, `settings-audit.test.ts` |
