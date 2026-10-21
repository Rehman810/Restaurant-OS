# Staff page screenshots

Capture with Playwright (requires `E2E_RUN=1`, seeded API, frontend dev server):

```bash
E2E_RUN=1 npm run test:e2e -w restaurant-os-web -- e2e/staff.spec.ts
```

Outputs:

- `staff-390-light.png`
- `staff-768-light.png`
- `staff-1440-light.png`

For dark theme, sign in manually, toggle theme, and save matching widths to the same folder (`staff-*-dark.png`).
