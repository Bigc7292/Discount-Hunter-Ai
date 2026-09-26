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
* **Verification**: Backend (Express + Puppeteer / geo proxies) — hosted-browser provider chain `BROWSER_PROVIDER_ORDER` (default `kernel,cloudflare,browserless,local`); unconfigured providers are skipped, and connect failure / 401 / 402 / 429 / quota falls through to the next provider
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

Env key names (values stay local / host secrets): see `.env.example` and `backend/.env.example`. **Discovery keys** (add to backend `.env`): `SERPER_API_KEY` (add first), `TAVILY_API_KEY`, then rely on **Jina Reader (no key)**; leave `ZERNIO_*` empty for **zero Zernio cost** (optional/paused); Agent-Reach Stage C is **wired** (`AGENT_REACH_ENABLED=1` default — Exa MCP zero-config; optional CLIs/cookies — see [DISCOVERY_WORK_TREE.md](./DISCOVERY_WORK_TREE.md)); `FIRECRAWL_API_KEY` (optional), `NVIDIA_API_KEY` (optional LLM extract). **Free path:** Serper + Tavily + Jina + Agent-Reach/Exa; Zernio skipped when key absent. **Checkout verifier browser keys** (backend): `BROWSER_PROVIDER_ORDER` (optional), `KERNEL_API_KEY` (+ optional `KERNEL_TIMEOUT_SECONDS`, `KERNEL_HEADLESS`), `CF_ACCOUNT_ID` + `CF_API_TOKEN` (+ optional `CF_BROWSER_KEEP_ALIVE_MS`), `BROWSERLESS_TOKEN`; `/health` reports `kernelConfigured`, `cloudflareBrowserConfigured`, `browserlessConfigured` (booleans). Launch-PR keys include `VITE_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_LIFETIME_PRICE_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `AGENTMAIL_INBOX_EMAIL`, `AGENTMAIL_API_KEY`, and rate-limit / ledger keys.

## Docs

* [DISCOVERY_WORK_TREE.md](./DISCOVERY_WORK_TREE.md) — **discovery stages** (Serper/Tavily/Jina; Agent-Reach Stage C; Zernio optional/cost-paused; Firecrawl optional), FACT vs JUDGMENT on zero-config vs cookies, env keys; candidates stay internal until verify
* [AGENTS.md](./AGENTS.md) — pipeline, confidence, local run
* [ARCHITECTURE.md](./ARCHITECTURE.md) — funnel & UI hierarchy
* [MIGRATION_TODO.md](./MIGRATION_TODO.md) — DoD / launch checklist (tied to open PRs)

---
*Authorized personnel only.*
