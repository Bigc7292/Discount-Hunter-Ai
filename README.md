# Discount Hunter AI

> **STATUS**: Alpha — launch work is on open PRs (not yet on `main`)  
> **SHIPPING**: via `gh` (CloudAgent unavailable on current plan)

Autonomous agent that **discovers, tests, and validates** merchant discount codes before showing them to users.

## Launch invariant

**Never surface untested / unverified codes in the UI.**  
Verify-only UI is implemented on [PR #4](https://github.com/Bigc7292/Discount-Hunter-Ai/pull/4) (`feat/verify-only-ui`) — **pending merge**.

## Open launch PRs (on branches — pending merge)

| PR | Branch | What it adds |
|----|--------|----------------|
| [#1](https://github.com/Bigc7292/Discount-Hunter-Ai/pull/1) | `feat/stripe-lifetime-firestore-persist` | Stripe $49 LTD checkout + Firestore inbox/history persist (pending owner secrets smoke) |
| [#2](https://github.com/Bigc7292/Discount-Hunter-Ai/pull/2) | `feat/verified-checkout-ledger` | Verified Checkout Ledger + rate limits on verify/discover |
| [#3](https://github.com/Bigc7292/Discount-Hunter-Ai/pull/3) | `feat/agentmail-verifier-inbox` | AgentMail inbox `discount-hunter@agentmail.to` (OTP stub) |
| [#4](https://github.com/Bigc7292/Discount-Hunter-Ai/pull/4) | `feat/verify-only-ui` | Verify-only UI — no unverified / social codes in UI |

Do **not** treat these as present on `main` until merged.

## Product rules

* **Bot email**: AgentMail only (`discount-hunter@agentmail.to`) — never personal email ([PR #3](https://github.com/Bigc7292/Discount-Hunter-Ai/pull/3), pending merge).
* **Data / auth**: **Firebase only** (Auth + Firestore). No Supabase.
* **Monetisation**: Optional **$49 LTD** via Stripe on [PR #1](https://github.com/Bigc7292/Discount-Hunter-Ai/pull/1) (pending merge). Research recommends freemium + ~$24/yr as the primary model later.

## Tech stack (as on `main` today)

* **Frontend**: React + TypeScript + Vite, Tailwind, Framer Motion
* **Discovery**: NVIDIA NIM (`meta/llama-3.3-70b-instruct`) + backend discovery services
* **Verification**: Backend (Express + Puppeteer / geo proxies)
* **Auth & DB**: Firebase (Auth & Firestore)

## Quick start

```bash
git clone https://github.com/Bigc7292/Discount-Hunter-Ai.git
cd Discount-Hunter-Ai
npm install
cp .env.example .env   # fill key names only — never commit secrets
npm run dev
```

Backend (separate terminal):

```bash
cd backend && npm install && cp .env.example .env && npm run dev
```

Env key names (values stay local / host secrets): see `.env.example` and `backend/.env.example`. Launch-PR keys (pending merge) include `VITE_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_LIFETIME_PRICE_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `AGENTMAIL_INBOX_EMAIL`, `AGENTMAIL_API_KEY`, and rate-limit / ledger keys.

## Docs

* [AGENTS.md](./AGENTS.md) — pipeline, confidence, local run
* [ARCHITECTURE.md](./ARCHITECTURE.md) — funnel & UI hierarchy
* [MIGRATION_TODO.md](./MIGRATION_TODO.md) — DoD / launch checklist (tied to open PRs)

---
*Authorized personnel only.*
