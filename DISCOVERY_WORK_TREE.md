# Discovery Work Tree

> **CORE LAW (non-negotiable):** Candidate codes stay **internal** until simulated checkout **VERIFIES** them. Never show unverified codes in the UI, API responses meant for end users, or marketing surfaces. Discovery feeds a **candidate pool** only; verification is the sole gate to user-visible results.

This document is the clear map of how Discount Hunter AI finds candidate codes across Google search, Reddit, forums, social platforms, deal aggregators, merchant pages, and influencer mentions — and how those candidates flow to verify-only display.

---

## 1. FACT: What exists on `main` today

### Source adapters (`backend/src/discovery/`)

| Adapter | File | Role | Key required? | Wired into orchestrator? |
|---------|------|------|---------------|--------------------------|
| **Serper** | `serperService.ts` | Google Search API — snippets + answer box; multi-query (coupon sites, Reddit, region, influencer) | `SERPER_API_KEY` | Yes — Phase 1 parallel |
| **Jina Reader** | `jinaService.ts` | URL → markdown; scrapes RetailMeNot / Groupon / Slickdeals / region aggregators + Serper hit URLs | **No** (anonymous `r.jina.ai`, ~20 req/min) | Yes — Phase 1 coupon pages + Phase 2 URL scrape |
| **Zernio** | `zernioService.ts` | Reddit search/feeds via Zernio (intended path for X/IG/TikTok/YouTube when accounts connected). **OPTIONAL / cost-paused by default** — leave keys empty for **zero Zernio spend** | `ZERNIO_API_KEY` + `ZERNIO_REDDIT_ACCOUNT_ID` (**omit to skip**) | Yes — Phase 1 parallel; **no-ops when key missing** |
| **Agent-Reach** | `agentReachService.ts` | Free Stage C social/search angles: **Exa MCP** (keyless HTTP), optional `yt-dlp` / `agent-reach` CLIs when in PATH; Reddit/X cookie CLIs stubbed | None for Exa; optional `AGENT_REACH_ENABLED`, `AGENT_REACH_BIN`, Twitter cookies | Yes — Phase 1 parallel; **graceful no-op** if disabled / deps missing |
| **Tavily** | `tavilyService.ts` | AI-native web search; deeper content for forums / influencer / affiliate codes | `TAVILY_API_KEY` | Yes — Phase 1 parallel |
| **Firecrawl** | `firecrawlService.ts` → `../firecrawlService.ts` | Clean markdown scrape via Firecrawl API | `FIRECRAWL_API_KEY` | **No** — service exists, **not** called by orchestrator yet |
| **Code extractor** | `codeExtractor.ts` | Regex fast-pass + optional NVIDIA NIM LLM pass → `CandidateCode[]` | `NVIDIA_API_KEY` optional (regex always runs) | Yes — after aggregate |
| **Region utils** | `regionUtils.ts` | Region inference + compatibility filter | None | Yes — post-extract filter |

Entry points: `backend/src/discovery.ts` → `orchestrator.discoverCodes()`; HTTP via backend `index.ts` discover route.

### Current execution order (FACT)

```
discoverCodes(query, region)
  │
  ├─ PHASE 1 (Promise.allSettled — parallel)
  │    ├─ Serper.searchForCodes()
  │    ├─ Jina.scrapeCouponPages()     // aggregator URLs by region
  │    ├─ Zernio.searchSocialMedia()   // Reddit (+ social if keyed) — no-op if key absent
  │    ├─ AgentReach.searchViaAgentReach() // Exa MCP + optional CLIs — Stage C preferred free path
  │    └─ Tavily.tavilySearchForCodes()
  │
  ├─ PHASE 2 (after Phase 1)
  │    └─ Jina.scrapeUrls(top Serper URLs, max 4)  // skips reddit.com
  │
  ├─ PHASE 3 — aggregate all { text, url, source }
  ├─ PHASE 4 — extractCodes() per source → Map dedupe by code
  └─ PHASE 5 — region filter → confidence sort → slice(0, 20)
       │
       ▼
  DiscoveryResult.candidates   ← INTERNAL ONLY
       │
       ▼
  Backend verify (Puppeteer checkout simulation)
       │
       ▼
  User-facing results = VERIFIED ONLY
```

Graceful degrade: missing keys → empty array from that adapter; pipeline continues. No source alone is allowed to mark a code “verified.”

### Env key names (discovery)

| Variable | Used by | Priority to add |
|----------|---------|-----------------|
| `SERPER_API_KEY` | Serper (Google) | **1 — first** |
| `TAVILY_API_KEY` | Tavily | **2** |
| *(none)* | **Jina Reader** (`r.jina.ai`) | **Already free** — no key |
| `ZERNIO_API_KEY` | Zernio social | **OPTIONAL / cost-paused** — leave empty for zero Zernio cost |
| `ZERNIO_REDDIT_ACCOUNT_ID` | Zernio Reddit | Only if/when re-enabling Zernio |
| `AGENT_REACH_ENABLED` | Agent-Reach Stage C | Default `1`; set `0` to disable |
| `AGENT_REACH_BIN` | Optional path to `agent-reach` CLI | Optional — PATH lookup if unset |
| `EXA_MCP_URL` | Exa MCP endpoint override | Optional — default `https://mcp.exa.ai/mcp?tools=web_search_exa` |
| `TWITTER_AUTH_TOKEN` / `TWITTER_CT0` | twitter-cli cookie path | **Optional sidecar only** — not required on Render |
| `FIRECRAWL_API_KEY` | Firecrawl (optional Stage D upgrade) | Optional; free-tier caution — see §3a |
| `NVIDIA_API_KEY` | LLM extract pass (regex works without) | Optional |

Also used elsewhere in backend (not discovery-only): `GEMINI_API_KEY`, proxy keys, AgentMail, Stripe, Firebase — see `backend/.env.example`.

---

## 2. Proposed Discovery Work Tree (target stages)

Map logical **stages** onto existing adapters. Stages may run in parallel where marked; all feed the same **candidate pool**. Style matches current services (`*Service.ts` + orchestrator).

```
                    ┌──────────────────────────────────────┐
                    │  QUERY + REGION                       │
                    │  parseStoreName / inferDomain         │
                    └──────────────────┬───────────────────┘
                                       │
     ┌─────────────┬─────────────┬─────┴─────┬─────────────┬─────────────┐
     ▼             ▼             ▼           ▼             ▼             ▼
 Stage A        Stage B       Stage C     Stage D       Stage E      (future)
 Web search    Deal aggs     Social+     Merchant      Influencer
 Serper+       Jina scrape   AgentReach  pages         / bios
 Tavily        RetailMeNot…  (+Zernio    Firecrawl/    Serper+
                              optional)  Jina          Tavily
     └─────────────┴─────────────┴─────┬─────┴─────────────┴─────────────┘
                                       ▼
                         CANDIDATE POOL (internal)
                                       │
                         dedupe by code string
                                       │
                         validate heuristics
                         (false-positive filters,
                          region compatibility,
                          confidence high|medium|low)
                                       │
                         verify gate (checkout sim)
                                       │
                         USER DISPLAY — verified only
```

### Stage A — Web search (owner: Serper + Tavily)

- **Adapters:** `serperService.ts`, `tavilyService.ts`
- **Coverage:** Google organic + answer box; AI search for forums / “working code” threads
- **Queries (existing):** promo/coupon year; `site:reddit.com`; region coupon sites; influencer/YouTube; Tavily forum + affiliate queries
- **Output:** `{ text, url, source }[]` snippets/content — **not** user codes

### Stage B — Deal aggregators (owner: Jina)

- **Adapter:** `jinaService.scrapeCouponPages`
- **Targets:** RetailMeNot, Groupon, Slickdeals; region: coupon.ae / rezeem / grabon (AE/SA), VoucherCodes (UK), Coupons.com / CouponFollow / Dealspotr (US default)
- **Output:** markdown page text for extractor

### Stage C — Social / free search (owner: **Agent-Reach** preferred; Zernio optional/paused)

- **Primary adapter:** `agentReachService.searchViaAgentReach` (wired)
  - **Zero-config (Node/Render):** Exa MCP HTTP search — no API key (rate-limited)
  - **When CLI in PATH:** `yt-dlp` YouTube search; optional `agent-reach doctor` probe
  - **Cookie stubs (optional sidecar):** `twitter` / `opencli` / `rdt` — skip cleanly without owner session
- **Secondary adapter:** `zernioService.searchSocialMedia` — **OPTIONAL / cost-paused.** Leave `ZERNIO_API_KEY` unset; service **skips** (`[]`); orchestrator continues via `Promise.allSettled`.
- **CORE LAW:** Agent-Reach (and Zernio) output = **candidates only** → verify gate. Never user-facing alone.
- **Output:** search/snippet/post text + URLs (candidates only)

### Stage D — Merchant / deep pages (owner: Firecrawl + Jina URL scrape)

- **Today:** Phase 2 `jinaService.scrapeUrls` on top Serper hits
- **Upgrade path:** wire `firecrawlService.fetchCleanedMarkdown` for JS-heavy merchant promo / student / referral pages when `FIRECRAWL_API_KEY` set; keep Jina as free fallback
- **Never** treat merchant marketing copy as verified

### Stage E — Influencer / bio mentions (owner: Serper + Tavily query angles)

- **Today:** Serper influencer/YouTube query; Tavily “influencer affiliate creator code”
- **Future adapters (optional):** platform-official APIs only (see §3) — bios, link-in-bio pages via Jina/Firecrawl URL list
- **Output:** candidate strings with source attribution

### Post-stages (always)

1. **Candidate pool** — union of all stage texts  
2. **Extract** — `codeExtractor` (regex → optional NIM)  
3. **Dedupe** — `Map` by normalized code; upgrade confidence on multi-source hits  
4. **Heuristics** — false-positive denylist, region filter (`isRegionCompatible`), confidence sort, cap (~20)  
5. **Verify** — Puppeteer (± geo proxy) simulated checkout  
6. **Display** — verified-only (UI invariant)

---

## 3. Integration candidates (public GitHub / APIs)

Reputable, lawful APIs/libs aligned with existing stack. **Not** spammy scrapers. Labels are **JUDGMENT**.

| # | Project | License / use note | JUDGMENT |
|---|---------|-------------------|----------|
| 1 | **[Serper](https://serper.dev)** (already integrated) — Google SERP API; free tier ~2.5k/mo | Commercial API ToS; no open-source core required | **Keep / prioritize key.** Best first signal for Stage A. |
| 2 | **[tavily-ai/tavily-js](https://github.com/tavily-ai/tavily-js)** (MIT) + Tavily API | MIT SDK; API needs `TAVILY_API_KEY` | **Adopt SDK optionally** to replace raw `fetch`; already call-compatible with Stage A/E. |
| 3 | **[jina-ai/reader](https://github.com/jina-ai/reader)** (Apache-2.0) | Apache-2.0; anonymous `r.jina.ai` or keyed higher limits | **Keep.** Primary Stage B/D free path; respect rate limits. |
| 4 | **[firecrawl/firecrawl](https://github.com/firecrawl/firecrawl)** (AGPL-3.0 server) + hosted API | Self-host = AGPL obligations; **hosted API** via `FIRECRAWL_API_KEY` is fine for SaaS without forking AGPL into product | **Wire into Stage D** when key available; do not vendor AGPL server into repo unless intentional. |
| 5 | **[not-an-aardvark/snoowrap](https://github.com/not-an-aardvark/snoowrap)** (MIT) or Reddit official API | MIT; requires Reddit app credentials / ToS; free Reddit API usability is **gated / approval-heavy** (JUDGMENT: verify before relying) | **Optional Reddit-only fallback** while Zernio is cost-paused — only if owner can still obtain usable free API access. |

**Honorable mentions (do not rush):** [exa-labs/exa-mcp-server](https://github.com/exa-labs/exa-mcp-server) (MIT) for semantic web search; Brave Search API (commercial) as Serper alternative; PRAW (BSD-2-Clause) if any Python sidecars appear. Avoid unaudited “coupon scraper” npm packages.

---

## 3a. Agent-Reach Stage C (wired) — FACT vs JUDGMENT

> **CORE LAW unchanged:** candidates stay internal until checkout verify. Agent-Reach never marks a code verified.

### FACT: what works zero-config (Render / Node Docker)

| Path | FACT |
|------|------|
| **Exa MCP HTTP** (`https://mcp.exa.ai/mcp`, tool `web_search_exa`) | Works **without API key** (rate-limited). Called from Node via JSON-RPC / SSE. Same free surface Agent-Reach documents via mcporter. |
| **Jina Reader** (`r.jina.ai`) | Already wired in Stage B/D — no key. Not re-implemented inside `agentReachService`. |
| **Graceful degrade** | Missing CLI / Exa failure / `AGENT_REACH_ENABLED=0` → `[]`; `Promise.allSettled` keeps pipeline alive. |
| **Zernio** | Still **no-ops** when `ZERNIO_API_KEY` absent (cost-paused). |

### FACT: what needs owner cookies / desktop session (optional sidecar)

| Path | FACT |
|------|------|
| **Reddit** | Agent-Reach: **no zero-config path** (anonymous endpoints blocked). Needs OpenCLI browser login or `rdt-cli` + cookies. |
| **Twitter/X** | Needs `twitter` CLI + `TWITTER_AUTH_TOKEN` / `TWITTER_CT0` in the **process** env. |
| **Render constraint** | Headless PaaS has **no owner Chrome profile**. Do **not** invent a desktop cookie session on Render. |

### JUDGMENT

| Claim | Label | Note |
|-------|-------|------|
| Prefer Agent-Reach Stage C over paid Zernio while cost-paused | **JUDGMENT: yes** | Exa MCP covers semantic “promo code” angles without Zernio spend |
| Ship cookie CLIs inside Render Docker by default | **JUDGMENT: no** | Ban/ToS/secret-rotation risk; stub + docs only |
| Optional owner laptop / sidecar with `agent-reach install` + cookies | **JUDGMENT: fine later** | Set `AGENT_REACH_BIN` / cookies on that host; still candidates → verify |
| ToS risk of cookie CLIs vs official APIs | **Caution** | Prefer official/paid APIs when affordable; keep candidates internal |

### How owner enables it

**Local**
1. Backend already calls Agent-Reach when `AGENT_REACH_ENABLED` is unset or `1`.
2. Zero-config: ensure outbound HTTPS to `mcp.exa.ai` (Exa).
3. Optional CLIs: install [Agent-Reach](https://github.com/Panniantong/Agent-Reach) / `yt-dlp` so they appear on `PATH` (or set `AGENT_REACH_BIN`).
4. Optional cookies (desktop only): configure Twitter/Reddit per upstream docs — never commit cookies.

**Render (`srv-d8u878lckfvc73esdtug`)**
1. Leave `AGENT_REACH_ENABLED` unset or `1` (default in code).
2. No Python Agent-Reach install required for Exa path.
3. Keep `ZERNIO_*` empty for zero Zernio cost.
4. Do **not** paste personal Reddit/X cookies into Render env unless you explicitly accept that ops risk later.

## 4. Owner checklist

1. Add **`SERPER_API_KEY`** first → retest discover endpoint with a store query; confirm Serper appears in `sourcesSearched`.  
2. Add `TAVILY_API_KEY`. Prefer **Serper + Tavily + Jina (no key) + Agent-Reach/Exa** while Zernio is cost-paused.  
3. **Leave `ZERNIO_*` empty** for zero Zernio cost (service skips). Re-add only when intentionally re-enabling paid social.  
4. Confirm Agent-Reach Stage C: discover logs / `sourcesSearched` may include `Agent-Reach (Exa/CLI)`; set `AGENT_REACH_ENABLED=0` to disable.  
5. Optionally `FIRECRAWL_API_KEY` before wiring Stage D upgrade (watch free-tier burn).  
6. Optional owner-desktop sidecar: install [Agent-Reach](https://github.com/Panniantong/Agent-Reach) CLIs + cookies — see §3a (not required on Render).  
7. Retest: discovery returns candidates **server-side only**; UI/API consumer shows **verified** codes only.  
8. Never invent or hardcode “verified” codes in docs, fixtures shown to users, or UI mocks.

---

## 5. Related docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — funnel & verify-only pipeline  
- [AGENTS.md](./AGENTS.md) — agent/service diagram  
- [README.md](./README.md) — quick start & env pointers  
- Code: `backend/src/discovery/orchestrator.ts`
