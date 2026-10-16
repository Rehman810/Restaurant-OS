# Tax invoicing (Phase 3 Task 4)

This document describes what the Restaurant OS implements for tax-ready invoicing and what remains for full statutory compliance (e.g. FBR integration in Pakistan).

## Built in the app

- **Store settings:** `taxEnabled`, legal name, business address, NTN (`taxNumber`), STRN (`taxStrn`), default and per-fulfillment / per-payment rates, fiscal-year vs daily invoice sequences, rounding rule, prices include tax.
- **Order snapshots:** Line-level taxable amount, tax amount, rate; order-level `taxableAmount`, `taxRatePercentSnap`, `taxInclusiveSnap`, `taxSnapshotJson` (immutable after checkout).
- **Invoice records:** Gap-free `TAX-{BRANCH}-{period}-{seq}` numbers via `BranchTaxInvoiceCounter`, legal/tax JSON snapshot, credit notes linked to original invoice on void/cancel when an invoice existed.
- **PDF:** A4 tax invoice PDF on delivery (or legacy `INV-*` when tax mode is off).
- **Reports:** `/admin/reports/tax-collected`, `tax-invoices`, `tax-credit-notes` (+ CSV).
- **Fiscal provider:** Pluggable `FiscalProvider` with a no-op default (`PENDING` submission status).

## Not built / accountant checklist

- [ ] Certified integration with a government e-invoicing / POS API (FBR, etc.).
- [ ] QR codes mandated by local law on thermal receipts (placeholder only in product brief).
- [ ] Multi-branch consolidated filing, withholding, or sector-specific taxes.
- [ ] Legal review of invoice wording, Arabic/Urdu statutory text, and retention periods.
- [ ] Automated submission retries and reconciliation dashboards beyond `submissionStatus`.

**Disclaimer:** Enabling tax in settings does not constitute legal advice or guarantee compliance. Validate rates, registration numbers, and filing obligations with your accountant.
