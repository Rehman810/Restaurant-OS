# Staff management

## Roles and privilege rules (server-enforced)

| Actor | List staff | Create | Promote to Admin | Edit Admin/Owner | Edit other managers |
|-------|------------|--------|------------------|------------------|---------------------|
| Owner (`isOwner` on demo admin) | All outlets | All roles incl. Admin | Yes | Yes | Yes |
| Admin (not owner) | All outlets | Non-admin roles | No | Limited | Yes |
| Manager | Own branches only | Non-manager roles in branch | No | No | No |
| Others | No access | — | — | — | — |

Additional rules:

- Nobody can change their own role or deactivate themselves.
- Owner account cannot be deactivated or reassigned via UI.
- At least one active non-test **Admin** must remain.
- Test users (`isTest` / `@test.local`) are hidden unless an admin enables **Created by tests**.

## Invite flow

1. **Add staff** with **Send email invite** (default): API creates the user, stores a single-use reset token (7 days), emails a link to `/reset-password?token=…`. No password is returned to the admin UI.
2. **Send invite off**: optional one-time temporary password (shown once in the success message) or manual password entry.

Admin-initiated **Reset password** always sends email; passwords are never shown in API responses.

## Two-factor authentication

Settings → **Alert thresholds**:

- `staffRequireTwoFaAdminManager` — when enabled, Admin and Manager accounts must enable TOTP after the grace period.
- `twoFaReminderDays` — grace period (default 7).

After grace, login returns `403` with `code: "2FA_REQUIRED"`.

## Test account cleanup

Read-only report:

```bash
npm run report-test-staff
```

Dry-run cleanup (default):

```bash
npm run cleanup-test-staff
```

Apply (after DB backup):

```bash
npm run cleanup-test-staff -- --apply
```

Never run `--apply` without reviewing `docs/reports/test-staff-*.csv`.

## API (summary)

`GET /admin/staff` — query: `q`, `role`, `branchId`, `status`, `twoFa`, `lastActive`, `includeTest`, `sort`, `order`, `page`, `pageSize`. Returns `staff[]`, `counts`, pagination.

Mutations: `POST /admin/staff`, `PATCH /admin/staff/:id`, `POST …/reset-password`, `POST …/reset-2fa`, `POST …/revoke-sessions`, `GET …/sessions`, `GET …/audit`, `GET /admin/staff/permissions`.

## Manual QA checklist

### Phone (390px, light + dark)

- [ ] No horizontal page scroll
- [ ] Filters sheet opens; search sticky
- [ ] Card list + actions menu (44px)
- [ ] Add staff drawer full width

### Tablet (768px) / Desktop (1440px)

- [ ] Table columns readable; email tooltip on truncate
- [ ] Role tiles filter URL; chips clear
- [ ] Pagination and sort

### Roles

- [ ] Owner: create admin, see test filter
- [ ] Admin: cannot create admin
- [ ] Manager: staff list branch-scoped; no admin edit actions
- [ ] Cashier: no `/admin/staff` access
