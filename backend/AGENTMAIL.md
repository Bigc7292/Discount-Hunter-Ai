# AgentMail verifier inbox

Bot mailbox path for merchant signup / OTP verification uses **AgentMail**, not Mailinator or any personal inbox.

| Setting | Value |
|--------|--------|
| Inbox | `discount-hunter@agentmail.to` |
| Display | Discount Hunter Verify |
| Purpose | `merchant-checkout-otp` |

**Rules**
- Never use Colin's (or any) personal email for merchant/OTP accounts.
- Do not commit `AGENTMAIL_API_KEY` or other secrets; names only in `.env.example`.
- Plus-addressing (`user+tag@…`) is **not** documented for AgentMail `@agentmail.to` inboxes. Profiles share this single inbox; OTP polling must filter by time and merchant/profile metadata (see `agentMailClient.ts` TODOs).

Env (server-only): `AGENTMAIL_INBOX_EMAIL`, `AGENTMAIL_API_KEY`.
