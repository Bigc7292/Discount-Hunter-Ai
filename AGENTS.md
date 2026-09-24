# Discount Hunter AI - Technical Architecture

## Overview
A SaaS platform that discovers REAL discount codes and verifies them through checkout simulation before presenting to users.

**Launch invariant**: never surface untested/unverified codes in the UI.  
Enforce path is on [PR #4](https://github.com/Bigc7292/Discount-Hunter-Ai/pull/4) (`feat/verify-only-ui`) — **on PR branch / pending merge**. Do not assume it is on `main` yet.

**Auth / data**: Firebase only (no Supabase).  
**Bot email**: AgentMail `discount-hunter@agentmail.to` only — never personal ([PR #3](https://github.com/Bigc7292/Discount-Hunter-Ai/pull/3), pending merge).

## Open launch PRs (pending merge — not on `main`)

| PR | Summary |
|----|---------|
| [#1](https://github.com/Bigc7292/Discount-Hunter-Ai/pull/1) | Stripe $49 LTD + Firestore inbox/history (pending owner secrets smoke) |
| [#2](https://github.com/Bigc7292/Discount-Hunter-Ai/pull/2) | Verified Checkout Ledger + rate limits |
| [#3](https://github.com/Bigc7292/Discount-Hunter-Ai/pull/3) | AgentMail OTP stub (`discount-hunter@agentmail.to`) |
| [#4](https://github.com/Bigc7292/Discount-Hunter-Ai/pull/4) | Verify-only UI (no unverified/social codes) |

**Monetisation**: $49 LTD optional on PR #1; research recommends freemium + ~$24/yr as primary later.  
**Shipping**: via `gh` (CloudAgent unavailable on plan).

## Tech Stack

### Was (Problematic)
- **Gemini 3 Pro** - Expensive ($10/M output tokens)
- **Simulated verification** - All codes marked "VERIFIED" without real testing
- **Fake success rates** - Hardcoded 100% successRate

### Now (Real / target)
- **NVIDIA NIM** - free tier available (`meta/llama-3.3-70b-instruct`)
- **Real verification** - headless browser tests codes against checkout
- **Real confidence scores** - based on actual test results
- **Verify-only UI** - pending merge on PR #4

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                      FRONTEND (Vite/React)                  │
│  HeroSearchBar → DashboardWorkspace → ResultsDisplay       │
│  (verify-only display: PR #4 — pending merge)               │
└────────────────────────────────┴──────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────┐
│                   searchService.ts                          │
│  Orchestrates: Discovery → Verification → Display         │
└────────────────────────────────┴──────────────────────────────┘
                                  │
          ┌──────────────────────┴───────────────────────┐
          ▼                                               ▼
┌──────────────────────┐                     ┌──────────────────────┐
│   nvidiaService     │                     │   apiService.ts      │
│   (Discovery Only)  │                     │   (Backend Verifier) │
│                     │                     │                     │
│ • discoverCodes()   │                     │ • verifyCodes()      │
│ • findInfluencer()  │                     │ • Real checkout test│
│ • checkGlitch()     │                     │ • Geo-proxy testing  │
│                     │                     │                     │
│ Uses NVIDIA NIM      │                     │ Browserless+Bright  │
└──────────────────────┘                     └──────────┴──────────┘
                                                        │
                     ┌─────────────────────────────────┼───────────────────────┐
                     ▼                                  ▼                        ▼
            ┌──────────────┐                   ┌──────────────┐          ┌──────────────┐
            │  US Region   │                   │  UAE Region  │          │  UK Region   │
            └──────────────┘                   └──────────────┘          └──────────────┘
```

Pending on PR branches (not `main`): Stripe + Firestore persist (PR #1), checkout ledger + rate limits (PR #2), AgentMail client (PR #3).

## Pipeline Flow

### 1. Discovery Phase (NVIDIA NIM + backend discovery)
- AI / scrapers find candidate codes with source attribution
- Candidates are **not** user-facing until verified

### 2. Verification Phase (Backend)
- Headless browser automation (Puppeteer)
- Human path: add item → checkout-stage promo → abandon (never paid purchase)
- Geo via residential proxies when configured
- Outcomes: verified | failed | expired | error

### 3. Display Phase (Frontend)
- **Target / PR #4**: show ONLY codes that passed verification
- Real confidence scores; show region tested
- Do **not** surface unverified or social-only codes in UI (launch invariant)

## Key Files

```
discount-hunter-ai/
├── src/
│   ├── services/
│   │   ├── nvidiaService.ts
│   │   ├── searchService.ts
│   │   ├── apiService.ts
│   │   └── recentSavingsService.ts
│   ├── components/
│   ├── types.ts
│   └── App.tsx
├── backend/
│   ├── src/
│   │   ├── index.ts
│   │   ├── verifier.ts
│   │   ├── browserBot.ts
│   │   ├── geoProxy.ts
│   │   ├── ledger.ts          # PR #2 — pending merge
│   │   ├── rateLimit.ts       # PR #2 — pending merge
│   │   ├── agentMailClient.ts # PR #3 — pending merge
│   │   └── discovery/
│   └── package.json
├── .env.example
├── AGENTS.md
├── ARCHITECTURE.md
└── MIGRATION_TODO.md          # DoD checklist tied to open PRs
```

## Confidence Scoring (Real)

| Score | Meaning |
|-------|---------|
| 86-100% | Recently tested & confirmed working |
| 61-85% | Multiple recent verifications |
| 31-60% | Community reports suggest works |
| 0-30% | Single source, unverified (must not be shown in UI once PR #4 merges) |

## Environment Setup (key names only)

### Frontend (`.env`) — on `main`
```env
VITE_NVIDIA_API_KEY=
VITE_VERIFIER_API_URL=http://localhost:3001
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

### Frontend — PR #1 pending merge
```env
VITE_STRIPE_PUBLISHABLE_KEY=
```

### Backend (`.env`) — on `main` (+ common)
```env
PORT=3001
GEMINI_API_KEY=
# Browserless.io hosted Chrome (primary when set)
BROWSERLESS_TOKEN=
# BROWSERLESS_API_TOKEN=   # alias
# BROWSERLESS_WS_ENDPOINT=wss://production-sfo.browserless.io
# Bright Data geo rotating residential (per testRegion)
RESIDENTIAL_PROXY_API_KEY=
RESIDENTIAL_PROXY_PROVIDER=brightdata
RESIDENTIAL_PROXY_CUSTOMER=
RESIDENTIAL_PROXY_ZONE=residential
RESIDENTIAL_PROXY_HOST=brd.superproxy.io
RESIDENTIAL_PROXY_PORT=22225
# Optional global Chromium override (wins over geo ProxyConfig):
# PROXY_SERVER=
# RESIDENTIAL_PROXY_URL=
# Local Chromium = fallback only when BROWSERLESS_TOKEN unset
USE_HEADLESS_BROWSER=true
BROWSER_TIMEOUT_MS=30000
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
```

### Backend — pending merge (PR branches)
```env
# PR #1
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_LIFETIME_PRICE_ID=
FRONTEND_URL=http://localhost:5173
FIREBASE_SERVICE_ACCOUNT_JSON=

# PR #2
RATE_LIMIT_VERIFY_PER_MIN=10
RATE_LIMIT_DISCOVER_PER_MIN=20
RATE_LIMIT_USER_PER_MIN=10
LEDGER_MEMORY_MAX=500

# PR #3 — AgentMail only, never personal
AGENTMAIL_INBOX_EMAIL=discount-hunter@agentmail.to
AGENTMAIL_API_KEY=
```

## Running Locally

```bash
# Terminal 1: Backend
cd backend && npm install && npm run dev

# Terminal 2: Frontend
npm install && npm run dev
```

## Deployment

- Frontend: Vercel (discounthunterai.xyz) — env keys via host secrets
- Backend: Node host (e.g. Railway) — verifier should run continuously
- Ship changes with `gh` PRs; CloudAgent unavailable on current plan


## Verify vs AgentMail (OTP)

- **Verify** = human-shopper path in Puppeteer (`browserBot`):
  1. `bootstrapCart(merchant)` — add a cheap/in-stock item (Nike/Adidas helpers + generic PLP/PDP fallback)
  2. Navigate toward checkout (prefer **guest**)
  3. Find promo field near the payment step (just BEFORE card details)
  4. Apply each candidate code → accept vs reject
  5. `abandonCart` — **NEVER** type/submit card details, **NEVER** place order
- Empty-cart / missing promo used to hide the field when we jumped straight to `/cart`. Cart bootstrap is now required before promo apply.
- Categorized `errorMessage` prefixes: `cart_bootstrap_failed` | `no_promo_field` | `code_rejected` | `timeout` | `bot_blocked`
- **Verify ALL discovery candidates** — no frontend `MAX_CODES_TO_VERIFY` / backend `codes.slice(0, 5)` product cap. UI still shows **verified only**.
- Batch uses **ONE** browser + **ONE** cart session (`simulateCheckoutBatch`); never spam parallel Chromiums on Render free.
- Timeouts scale with N: per-code ~55s; batch = bootstrap buffer + N × per-code, **hard max ~20 min**; frontend abort aligned. If Render free kills the HTTP request sooner, progressive/partial results already collected are returned when the batch deadline fires — prefer a paid Node host for large N.
- Anti-bot: `puppeteer-extra` + stealth plugin (fragile evasions disabled) + CDP overrides; realistic UA/viewport/locale/timezone; jittered human delays + optional mouse moves; homepage/PLP **warm-up** before cart bootstrap.
- Circuit breaker: on `bot_blocked`, soft-pause once (~10–18s) and retry; if still blocked, abort remaining codes (don't burn the queue).
- **Browser stack (owner locked)**: (1) **Browserless.io** = primary hosted Chrome via `puppeteer.connect` when `BROWSERLESS_TOKEN` (or `BROWSERLESS_API_TOKEN`) is set; (2) **Bright Data** geo rotating residential = existing `geoProxy.ts` / `ProxyConfig` per `testRegion`; (3) **Local Chromium** + stealth = fallback only when Browserless token unset. Render stays a thin API.
- Browserless WS default: `wss://production-sfo.browserless.io?token=…` (BaaS v2 docs 2026). Override base with `BROWSERLESS_WS_ENDPOINT`. Geo proxy prefers Browserless `externalProxyServer=http://user:pass@host:port` (paid Browserless plan required for third-party proxies); else `launch.args --proxy-server` + `page.authenticate`.
- Geo residential proxy (owner supplies; never commit secrets): `RESIDENTIAL_PROXY_API_KEY` (+ optional `RESIDENTIAL_PROXY_CUSTOMER` / `ZONE` / `HOST` / `PORT`). `geoProxy.makeProxy` builds country-matched username; each verify batch adds `-session-{random}` for IP rotation. `browserBot.getBrowser(proxy)` attaches proxy to Browserless or local Chromium, and **reconnects/relaunches** the singleton when the effective proxy key changes (US vs UK / new session).
- Global override: `PROXY_SERVER` or `RESIDENTIAL_PROXY_URL` → Chromium `--proxy-server` (http/socks); wins over geo ProxyConfig. See `backend/.env.example`.
- `/health` exposes `browserlessConfigured` + `geoProxyConfigured` + `envProxyOverride`; startup logs Browserless CONFIGURED/NOT SET and geo host/zone/customer presence (never the password/token).
- Local Chromium fallback: `PUPPETEER_EXECUTABLE_PATH` / `CHROME_PATH` or Puppeteer bundled — **never** Windows Chrome default (Render/Linux).
- Puppeteer-extra under `moduleResolution: NodeNext`: import via `addExtra(vanillaPuppeteer)` — do not `import puppeteer from 'puppeteer-extra'` (tsc TS2339 on `.use` / `.launch`; Render Docker `npm run build` fails exit 2 even with `noEmitOnError: false`).
- **AgentMail** inbox `discount-hunter@agentmail.to` is for **future OTP only** until `AGENTMAIL_API_KEY` is set on Render **and** `fetchLatestOtp` is implemented. Do not expect AgentMail to fix cart bootstrap, Nike bot-blocks, or page-load timeouts.

## Notes

- Real verification benefits from **Browserless + Bright Data residential** (Nike often bot-blocks datacenter IPs on Render free tier). Set `BROWSERLESS_TOKEN` for hosted Chrome and `RESIDENTIAL_PROXY_API_KEY` (+ Bright Data customer/zone) so `testRegion` maps to a country-matched rotating exit IP. `PROXY_SERVER` / `RESIDENTIAL_PROXY_URL` remain a global override. Do not invent or commit credentials.
- Without Browserless, local Chromium still runs (fallback). Without geo proxies, verification still runs but without geo-specific results and higher bot-block risk. Browserless `externalProxyServer` needs a paid Browserless plan.
- See [MIGRATION_TODO.md](./MIGRATION_TODO.md) for DoD gates before launch
