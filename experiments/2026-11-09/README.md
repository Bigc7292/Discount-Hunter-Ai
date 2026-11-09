# AI-digest experiment — 2026-11-09: Stroq (free, Apache-2.0, local agent-command auditor)
Test branch only. No app, verifier, CI, secrets or deploy files changed.

Why: the verifier runs Puppeteer + stealth plugins and agents (Cursor/Claude/Grok) edit this repo; Stroq checks repos before you run them and can guard agent commands. Runs locally, no telemetry, no account.

| Check | Before | After |
|---|---|---|
| `npm run build` (front end, Vite) | passes, 3.4 s | passes, unchanged (no code changes) |
| Pre-run audit of the repo | none | `stroq inspect .` in 0.26 s: 0 real findings; 5 "minified" flags, all our own `dist/` build output (false positives) |
| Known agent-attack scenarios (`stroq attack`, vendor's sandboxed suite) | none | 36/36 caught (15 blocked, 21 asked), 0 passed. Note: vendor's own suite, self-graded |

Commands (installed in a scratch folder, `--ignore-scripts`, nothing global):
`npm i @stroq/cli@0.31.0 && npx stroq inspect <repo>`; `npx stroq attack`.
Not run: `stroq init` (it installs hooks into your agent configs on the machine where you code — your call).
Verdict: maybe — worth `stroq inspect` on any third-party repo/skill/MCP before running it, and `stroq init` on your own PC. It is dev-machine safety, not a product feature, and it does not sandbox (it filters/asks).
