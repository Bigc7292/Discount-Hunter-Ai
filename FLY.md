# Fly.io — verifier backend

Primary host for the Discount Hunter verifier API (replaces Railway for this deploy path).

> Secrets are **owner-provided** — never commit them. Do not paste secret values into issues/PRs.

## App

| Setting | Value |
|--------|--------|
| App name | `discount-hunter-api` (or next available similar name) |
| Config | `backend/fly.toml` |
| Dockerfile | `backend/Dockerfile` |
| Internal port | **3001** (matches `EXPOSE`; Fly sets `PORT`, app reads `process.env.PORT \|\| 3001`) |
| Preferred region | `iad` (fallback `lhr`) |
| VM | `shared-cpu-2x` / **2GB RAM** (Puppeteer/Chromium; drop to 1GB only if allowance requires) |
| Health | `GET /health` |

Public URL pattern: `https://discount-hunter-api.fly.dev`

## One-shot deploy (owner / CI with `FLY_API_TOKEN`)

```bash
export PATH="$HOME/.fly/bin:$PATH"
export FLY_API_TOKEN=...   # from Fly dashboard or org token

cd backend
# First time only (org must have billing / free allowance card on file):
fly apps create discount-hunter-api --org personal
# or: fly launch --no-deploy --copy-config --name discount-hunter-api --org personal --region iad

fly secrets set \
  STRIPE_SECRET_KEY=... \
  STRIPE_YEARLY_PRICE_ID=... \
  STRIPE_LIFETIME_PRICE_ID=... \
  FIREBASE_SERVICE_ACCOUNT_JSON="$(tr -d '\n' < /path/to/firebase-service-account.json)" \
  AGENTMAIL_INBOX_EMAIL=discount-hunter@agentmail.to \
  NODE_ENV=production \
  USE_HEADLESS_BROWSER=true \
  FRONTEND_URL=https://discounthunterai.xyz \
  LOG_LEVEL=info

# Do NOT set STRIPE_WEBHOOK_SECRET until the public URL exists.
fly deploy
curl -sS https://discount-hunter-api.fly.dev/health
```

After first successful deploy:

1. Create Stripe webhook → `https://<app>.fly.dev/stripe/webhook` (events: at least `checkout.session.completed`).
2. `fly secrets set STRIPE_WEBHOOK_SECRET=whsec_...`
3. Point Vercel `VITE_VERIFIER_API_URL` at `https://<app>.fly.dev` (no trailing slash).
4. Update `FRONTEND_URL` when the real Vercel origin is live:  
   `fly secrets set FRONTEND_URL=https://<vercel-origin>`

## Env vars (names only)

| Name | Required | Notes |
|------|----------|--------|
| `PORT` | injected | Fly sets this; Dockerfile/`fly.toml` internal_port is 3001 |
| `NODE_ENV` | yes | `production` |
| `USE_HEADLESS_BROWSER` | yes | `true` |
| `FRONTEND_URL` | yes | CORS + Stripe redirects |
| `LOG_LEVEL` | recommended | e.g. `info` |
| `STRIPE_SECRET_KEY` | for billing | Test/live secret |
| `STRIPE_YEARLY_PRICE_ID` | for billing | Yearly Price id |
| `STRIPE_LIFETIME_PRICE_ID` | for billing | Lifetime Price id |
| `STRIPE_WEBHOOK_SECRET` | after URL | Set **after** public URL + Stripe webhook |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | for auth/ledger | Entire JSON as **one line** |
| `AGENTMAIL_INBOX_EMAIL` | for AgentMail | e.g. `discount-hunter@agentmail.to` |
| `CHROME_PATH` / `PUPPETEER_*` | Dockerfile | Override only if needed |

Optional (same names as Railway path): `GEMINI_API_KEY`, proxies, Redis, rate-limit knobs — see `DEPLOY.md`.

## Billing prerequisite

Fly requires payment method / credit on the org before `fly apps create` / `fly deploy`.  
Dashboard: https://fly.io/dashboard → org billing.

## Smoke test

```http
GET https://<app>.fly.dev/health
```

Expect JSON roughly: `{ "status": "healthy", "timestamp": "...", ... }`.
