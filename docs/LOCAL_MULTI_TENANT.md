# Local multi-tenant URLs

Test each restaurant on its own host (like production subdomains) without deploying.

## One-time setup

```bash
cd backend
npm run tenancy:local-dev
```

Copy the printed env lines into `backend/.env` and `frontend/.env.local`, then restart **API** and **frontend**.

## Open in the browser

| Tenant | URL |
| --- | --- |
| Slug `main` | http://main.localhost:3000 |
| Slug `iso-649cfdd8` | http://iso-649cfdd8.localhost:3000 |
| Platform (all tenants) | http://localhost:3100 |

Chrome and Firefox resolve `*.localhost` to `127.0.0.1` — no `/etc/hosts` edit needed.

Staff admin: `http://main.localhost:3000/admin/login` (separate cookies per host).

## How it works

- `Restaurant.hostname` = `{slug}.localhost` (set by `tenancy:local-dev`).
- Frontend proxy and SSR send `x-tenant-host` + `TENANT_PROXY_SECRET` to the API.
- `SINGLE_TENANT_MODE=false` so plain `http://localhost:3000` no longer forces tenant #1.

## Verify API

```bash
curl -s -H "x-tenant-host: main.localhost" \
  -H "x-tenant-proxy-secret: local-dev-tenant-proxy" \
  http://localhost:4000/settings/public | head -c 120
```

Repeat with `iso-649cfdd8.localhost` — JSON should differ.
