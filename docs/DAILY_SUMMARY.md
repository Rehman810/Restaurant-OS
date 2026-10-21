# Daily summary (close-out)

## Definitions

- **Booked** — Sum of order totals for non-cancelled orders placed on the store date (`createdAt` in range).
- **Collected** — Sum of totals for completed orders (delivered, collected, served) placed on the store date.
- **AOV** — Collected ÷ completed order count.
- **Store day** — Midnight–midnight in branch timezone (`branchDayRangeUtc`), same as Dashboard and Analytics.

## Reconciliation

- **Collected** must equal Cash + Card + COD received + Unspecified (from `OrderPayment` rows, with legacy fallback to `order.paymentMethod`).
- **Booked** must equal Collected + Not yet collected (unpaid, COD due, partial balances on incomplete orders).
- Mismatches surface in `needsAttention` and `money.reconciles` (logged server-side).

## Provisional vs final

**Final** when: **no open cash shifts anywhere in the branch** (including shifts opened on earlier days), no pending rider cash for that store date, payment reconciliations pass, and no completed orders missing payment method. Closed shifts that ran that day should have counted cash when present.

## Payment split (no “Online” bucket)

Collected = **Cash** (in-store/POS) + **Card** + **COD received** (cash on completed deliveries) + **Unspecified** (legacy rows). Storefront “online” orders are still counted in booked/collected; payment method is cash or card/COD only.

## API

- `GET /admin/daily-summary?date=YYYY-MM-DD&compare=yesterday|lastWeek|none`
- `GET /admin/reports/daily-summary` (same handler)
- `GET /admin/daily-summary/export.csv` — UTF-8 BOM CSV

Roles: **ADMIN**, **MANAGER** only (server + nav). **CASHIER** / **CHEF** have no nav entry.

## Email

- Settings → Scheduled reports: **Daily close-out email** (enabled, hour/minute in store TZ, default 23:30).
- Recipients: `dailyCloseoutEmailRecipients`, or falls back to analytics recipients.
- Scheduler runs every 15 minutes with analytics email job.
- Test: `POST /admin/daily-summary/email/test` or **Send close-out test email** in settings / daily summary header.

## Notifications

After the configured close-out time, ADMIN/MANAGER clients poll `GET /admin/daily-summary/blockers`. If open shifts remain, a **day close-out blocked** item is pushed to the staff bell feed (deduped per store day).

## Manual QA checklist

- [ ] Closed day with all shifts counted → status **Final**
- [ ] Open shift → **Provisional**, unclosed shift in Needs attention
- [ ] COD due on booked-but-not-collected orders
- [ ] Zero-order day → empty state
- [ ] Previous / Next / Today updates URL `date`
- [ ] Payment proof line matches Collected
- [ ] Print hides chrome (browser print)
- [ ] Mobile 390px — no horizontal scroll
