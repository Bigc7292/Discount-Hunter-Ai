# Launch / DoD checklist

Stale “CodeSniper demo → production” steps removed. This checklist matches **live launch PRs** and Definition of Done. Features below are **on PR branches / pending merge** unless noted.

**Stack**: Firebase only (Auth + Firestore). No Supabase.  
**Shipping**: `gh` PRs (CloudAgent unavailable on plan).  
**Invariant**: never surface untested/unverified codes in the UI.

## A. Open launch PRs (merge when green)

- [ ] **PR [#1](https://github.com/Bigc7292/Discount-Hunter-Ai/pull/1)** — Stripe $49 LTD + Firestore inbox/history  
  - Owner: configure secrets smoke (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_LIFETIME_PRICE_ID`, `VITE_STRIPE_PUBLISHABLE_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `FRONTEND_URL`)
  - Confirm Checkout + webhook → lifetime entitlement; inbox/history persist for signed-in users
- [ ] **PR [#2](https://github.com/Bigc7292/Discount-Hunter-Ai/pull/2)** — Verified Checkout Ledger + rate limits  
  - Keys: `RATE_LIMIT_VERIFY_PER_MIN`, `RATE_LIMIT_DISCOVER_PER_MIN`, `RATE_LIMIT_USER_PER_MIN`, `LEDGER_MEMORY_MAX`, optional `FIREBASE_SERVICE_ACCOUNT_JSON`
  - Confirm ledger only records verified outcomes; limits hit expected 429s
- [ ] **PR [#3](https://github.com/Bigc7292/Discount-Hunter-Ai/pull/3)** — AgentMail OTP stub  
  - Keys: `AGENTMAIL_INBOX_EMAIL=discount-hunter@agentmail.to`, `AGENTMAIL_API_KEY` (server-only)
  - **Never** wire personal email as bot inbox
- [ ] **PR [#4](https://github.com/Bigc7292/Discount-Hunter-Ai/pull/4)** — Verify-only UI  
  - UI shows verified codes only; no unverified / social-only codes

## B. DoD gates (before calling launch “done”)

- [ ] Merge order agreed; conflicts resolved against `main` without regressing verify-only
- [ ] Production Firebase rules: user-scoped inbox/history; public ledger read only if intentional (see PR #2 rules)
- [ ] No unverified codes reachable from Results / cards / social paths
- [ ] Bot email remains AgentMail-only
- [ ] Stripe LTD optional path smoke-tested in **test mode** (PR #1); freemium + ~$24/yr deferred (research recommendation — not this launch)

## C. Explicitly out of scope for this launch docs sync

- Inventing that PR #1–#4 are already on `main`
- Supabase or non-Firebase backends
- CloudAgent-based deploy (unavailable — use `gh`)
