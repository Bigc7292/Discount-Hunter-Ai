# Deploy — Vercel (frontend) + Fly.io (verifier backend)

> **Backend host:** Prefer **Fly.io** (`FLY.md`, `backend/fly.toml`). Railway remains a documented alternative below.

**Launch DoD #4:** Frontend + verifier backend deployed and wired.

> **Status:** This repo hardens deploy artifacts and docs so the **owner** can one-shot deploy.
> Production is **not** claimed live here. All secrets are **owner-provided** — never commit them.

Successor platforms (Cloudflare Pages, Fly.io, Render, etc.) are fine if they replace Vercel/Railway; keep the same env **names** and health/CORS wiring.

**Fly.io (current preferred backend):** see **[FLY.md](./FLY.md)** — app `discount-hunter-api`, region `iad`, internal port `3001`, ≥1–2GB RAM for Chromium.

---

## Step order (owner)

1. **Deploy backend on Fly.io** (see [FLY.md](./FLY.md); needs public HTTPS URL first). Railway is an alternative — same env names.
2. **Deploy frontend on Vercel** with `VITE_VERIFIER_API_URL` = that Fly (or Railway) URL (no trailing slash).
3. **Set `FRONTEND_URL` on Fly** (`fly secrets set`) to the Vercel origin so CORS + Stripe redirects work.
4. **Deploy `firestore.rules`** (and indexes if needed) via Firebase CLI / Console.
5. **Wire Stripe webhook** to Fly (or Railway) after public URL exists; then set `STRIPE_WEBHOOK_SECRET`.
6. Smoke-test: `GET {FLY_URL}/health` → frontend hunt → optional Stripe test checkout.

Do **not** merge open feature PRs (#1–#5) from this guide; merge order is owner-owned. Env names below include those PRs so deploy stays ready after they land.

---

## 1. Railway — verifier backend

### Repo settings

| Setting | Value |
|--------|--------|
| Root Directory | `backend` |
| Builder | **Dockerfile** (`backend/Dockerfile`) |
| Start command | `node dist/index.js` (also in `railway.toml` / `railway.json`) |
| Health check path | **`/health`** |

Artifacts already in repo:

- `backend/Dockerfile` — Node 20 Alpine + **system Chromium** for Puppeteer (`PUPPETEER_EXECUTABLE_PATH` / `CHROME_PATH`)
- `backend/railway.toml` / `backend/railway.json` — Dockerfile builder, start command, `/health`
- `backend/Procfile` — `web: node dist/index.js` (Heroku-style fallback)

### Backend env vars (names only — owner fills values)

| Name | Notes |
|------|--------|
| `PORT` | Usually injected by Railway; app defaults to `3001` |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | Vercel origin, e.g. `https://your-app.vercel.app` (CORS + Stripe success/cancel) |
| `GEMINI_API_KEY` | Optional discovery AI |
| `RESIDENTIAL_PROXY_API_KEY` | Optional geo proxies |
| `RESIDENTIAL_PROXY_PROVIDER` | e.g. `brightdata` |
| `USE_HEADLESS_BROWSER` | `true` |
| `BROWSER_TIMEOUT_MS` | e.g. `30000` |
| `REDIS_URL` | Optional |
| `LOG_LEVEL` | e.g. `info` |
| `CHROME_PATH` / `PUPPETEER_EXECUTABLE_PATH` | Set by Dockerfile; override only if needed |

**From open PR #1 (Stripe + Firebase Admin):**

| Name | Notes |
|------|--------|
| `STRIPE_SECRET_KEY` | Test/live secret — owner-provided |
| `STRIPE_WEBHOOK_SECRET` | From Stripe webhook endpoint |
| `STRIPE_LIFETIME_PRICE_ID` | One-time lifetime Price id |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Service account JSON as **one-line** string |

**From open PR #2 (rate limit + ledger):**

| Name | Notes |
|------|--------|
| `RATE_LIMIT_VERIFY_PER_MIN` | Default `10` |
| `RATE_LIMIT_DISCOVER_PER_MIN` | Default `20` |
| `RATE_LIMIT_USER_PER_MIN` | Default `10` |
| `LEDGER_MEMORY_MAX` | Default `500` when Firestore unavailable |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Same as above (ledger persist) |

**From open PR #3 (AgentMail):**

| Name | Notes |
|------|--------|
| `AGENTMAIL_INBOX_EMAIL` | e.g. `discount-hunter@agentmail.to` |
| `AGENTMAIL_API_KEY` | Server-only — never commit |

### Health check

```http
GET /health
```

Expect JSON roughly: `{ "status": "healthy", "timestamp": "...", "regions": [...], "version": "..." }`.

Use this path in Railway health checks and any uptime monitor.

### Stripe webhook (after PR #1)

- Endpoint URL: `https://{RAILWAY_PUBLIC_HOST}/stripe/webhook`
- Events: at least `checkout.session.completed` (per PR #1)
- Copy signing secret into `STRIPE_WEBHOOK_SECRET` on Railway
- Never commit webhook secrets

---

## 2. Vercel — Vite SPA frontend

### Repo settings

| Setting | Value |
|--------|--------|
| Root Directory | repo root (where `package.json` + `vite.config.ts` live) |
| Framework | Vite (see root `vercel.json`) |
| Build | `npm run build` |
| Output | `dist` |
| SPA rewrites | `/(.*)` → `/index.html` |

### Frontend env vars (names only — set in Vercel dashboard)

| Name | Notes |
|------|--------|
| `VITE_VERIFIER_API_URL` | **Railway public HTTPS URL**, no trailing slash |
| `VITE_NVIDIA_API_KEY` | NVIDIA NIM (current discovery path) |
| `VITE_FIREBASE_API_KEY` | Firebase web config |
| `VITE_FIREBASE_AUTH_DOMAIN` | |
| `VITE_FIREBASE_PROJECT_ID` | |
| `VITE_FIREBASE_STORAGE_BUCKET` | |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | |
| `VITE_FIREBASE_APP_ID` | |
| `VITE_STRIPE_PUBLISHABLE_KEY` | From PR #1 (TEST publishable key) |

Redeploy Vercel after changing any `VITE_*` variable.

---

## 3. Wire frontend ↔ backend

1. Railway deploy finishes → copy public URL (`https://….up.railway.app` or custom domain).
2. Vercel: set `VITE_VERIFIER_API_URL=https://….up.railway.app` → redeploy.
3. Railway: set `FRONTEND_URL=https://….vercel.app` (exact browser origin) → restart.
4. Browser: open Vercel app → hunt should call Railway `/discover` + `/verify`.
5. Confirm `GET {VITE_VERIFIER_API_URL}/health` from browser or curl.

CORS: backend uses `FRONTEND_URL` when set; otherwise `*` (local/dev). Production should always set `FRONTEND_URL`.

---

## 4. Firestore rules

Deploy rules from repo (do not paste secrets into rules):

```bash
firebase deploy --only firestore:rules
# optional indexes:
firebase deploy --only firestore:indexes
```

Or paste/publish `firestore.rules` in Firebase Console → Firestore → Rules.

After PR #1 / #2 merge, redeploy rules so `history` / `checkoutLedger` matches those PRs.

---

## 5. Never commit secrets

- Use `.env` / `.env.local` locally; they are gitignored.
- Put production values only in **Vercel** and **Railway** dashboards (or their secret stores).
- `FIREBASE_SERVICE_ACCOUNT_JSON`, Stripe secrets, AgentMail keys, API keys = owner-provided.
- `.env.example` / `backend/.env.example` list **names only**.

---

## Quick smoke checklist (owner)

- [ ] Railway build uses Dockerfile; Chromium present
- [ ] `GET /health` returns healthy
- [ ] Vercel build succeeds; SPA routes refresh without 404
- [ ] `VITE_VERIFIER_API_URL` points at Railway
- [ ] `FRONTEND_URL` on Railway matches Vercel origin
- [ ] Firestore rules deployed
- [ ] (Optional) Stripe webhook → `/stripe/webhook` + test card
- [ ] No secrets in git history of this PR

---

## Related docs

- `VERCEL_SETUP.md` — older Vercel env notes (Gemini-era); prefer this file for DoD #4
- `DEPLOYMENT_GUIDE.md` — longer Firebase / custom-domain walkthrough
- `backend/AGENTMAIL.md` — after PR #3 (AgentMail inbox)

**Blockers for the agent (not owner):** cannot set owner secrets, cannot click Vercel/Railway dashboards, cannot claim production live.
