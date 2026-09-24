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
│ Uses NVIDIA NIM      │                     │ Puppeteer + proxies │
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
RESIDENTIAL_PROXY_API_KEY=
RESIDENTIAL_PROXY_PROVIDER=brightdata
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
- Batch uses one cart session when possible (`simulateCheckoutBatch`); per-code timeout ~60s; batch budget ~5 min; frontend verifier abort ~6 min.
- Chromium: `PUPPETEER_EXECUTABLE_PATH` / `CHROME_PATH` or Puppeteer bundled — **never** Windows Chrome default (Render/Linux).
- **AgentMail** inbox `discount-hunter@agentmail.to` is for **future OTP only** until `AGENTMAIL_API_KEY` is set on Render **and** `fetchLatestOtp` is implemented. Do not expect AgentMail to fix cart bootstrap, Nike bot-blocks, or page-load timeouts.

## Notes

- Real verification benefits from residential proxies for geo-targeting (Nike often bot-blocks datacenter IPs on Render free tier)
- Without proxies, verification still runs but without geo-specific results and higher bot-block risk
- See [MIGRATION_TODO.md](./MIGRATION_TODO.md) for DoD gates before launch
