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
  │    ├─ Zernio.searchSocialMedia()   // Reddit (+ social if keyed)
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
 Web search    Deal aggs     Social      Merchant      Influencer
 Serper+       Jina scrape   Zernio      pages         / bios
 Tavily        RetailMeNot…  Reddit/X/   Firecrawl/    Serper+
                               IG/TT      Jina          Tavily
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

### Stage C — Social (owner: Zernio — **OPTIONAL / cost-paused**)

- **Adapter:** `zernioService.searchSocialMedia`
- **Cost policy (owner):** **zero Zernio spend for now.** Leave `ZERNIO_API_KEY` unset; service **skips** (returns `[]`) and orchestrator continues via `Promise.allSettled`.
- **Today (when keyed):** Reddit search + feeds (`promocodes`, `deals`, region subs)
- **Intended expansion (same key, later):** X / Instagram / TikTok / YouTube when Zernio accounts connected — still candidates only
- **Free / low-cost alternative research:** see **§3a** (Agent-Reach + upstream CLIs) — **docs only in this PR; not wired into production runtime**
- **Output:** post/comment text + permalinks (candidates only)

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

## 3a. Free / low-cost social layer (research — not wired)

> **Scope of this section:** documentation + owner evaluation only. **Do not** install Agent-Reach or cookie CLIs into the Render production runtime in this PR. CORE LAW unchanged: candidates stay internal until checkout verify.

### Why look here?

Owner wants **zero Zernio cost for now**. Stage A/B already cover a lot via **Serper + Tavily + Jina (no key)**. Stage C social depth needs a **free / low-cost** path that does not burn Zernio credits.

### FACT: [Panniantong/Agent-Reach](https://github.com/Panniantong/Agent-Reach)

| Field | FACT |
|-------|------|
| License | **MIT** |
| Stars (approx., check live) | ~85k on GitHub at research time |
| Role | Installer / doctor / router CLI — routes agents to **upstream** tools; not a paid SaaS wrapper |
| Positioning | “Read & search Twitter, Reddit, YouTube, GitHub, … — one CLI, **zero API fees**” (project claim) |
| Web | [Jina Reader](https://github.com/jina-ai/reader) (`r.jina.ai`) — no API key for anonymous use |
| YouTube | [yt-dlp](https://github.com/yt-dlp/yt-dlp) |
| Reddit | [rdt-cli](https://github.com/public-clis/rdt-cli) and/or OpenCLI — **cookie / logged-in session**; anonymous Reddit endpoints are blocked per upstream docs |
| Twitter/X | [twitter-cli](https://github.com/public-clis/twitter-cli) — **cookies** (`TWITTER_AUTH_TOKEN` / `TWITTER_CT0`) |
| Semantic web search | [Exa](https://exa.ai) via [mcporter](https://github.com/nicobailon/mcporter) (Agent-Reach install path) |

### JUDGMENT (ours)

| Claim | Label | Note |
|-------|-------|------|
| Suitable as a **local / owner-desktop** research CLI for finding candidate URLs/posts | **JUDGMENT: yes, promising** | Aligns with zero Zernio spend |
| Drop-in replacement for `zernioService` on **Render** today | **JUDGMENT: no** | Cookie CLIs need an **owner browser session**; a headless cloud box cannot “silently” reuse desktop cookies without the owner exporting/rotating them into server secrets |
| Wire into production orchestrator in this PR | **No** | Docs/research only unless a later PR explicitly opts in |
| ToS / ToU risk of cookie CLIs vs platform official APIs | **Caution** | Cookie-based access may violate platform Terms; prefer official APIs when affordable; keep candidates internal; never invent codes |

### Why server-side Render cannot silently use cookie CLIs

1. **FACT:** `rdt-cli` / `twitter-cli` authenticate with **cookies or browser login state** belonging to a human session.
2. **FACT:** Render (and similar PaaS) runs **headless server processes** with no owner Chrome profile attached.
3. **JUDGMENT:** Shipping owner cookies into `backend` env is possible but is an **explicit, high-risk ops choice** (secret rotation, ban risk, ToS) — not something the app should do automatically.
4. **FACT today:** `zernioService.searchSocialMedia` already **skips** when `ZERNIO_API_KEY` is unset (`return []`); orchestrator uses `Promise.allSettled` — discovery continues on Serper / Jina / Tavily.

**Practical free path now:** prefer **SERPER + TAVILY + Jina (no key)**; leave Zernio empty; use Agent-Reach / upstream CLIs only on an **owner machine** for ad-hoc research until a sanctioned server path exists.

### Other free-ish options beyond Agent-Reach (short list)

| Option | Cost shape | Caution |
|--------|------------|---------|
| **Exa** (API or via mcporter) | Free/low tier for semantic search | Rate limits / ToS; keys if not using Agent-Reach path |
| **Jina Reader** | Anonymous free tier (~20 req/min) | Already integrated; respect rate limits |
| **Firecrawl hosted free tier** | Limited free credits | Easy to burn; AGPL if self-hosting server — prefer hosted key only |
| **DuckDuckGo HTML search libs** (e.g. community `duckduckgo-search`) | Often free, no key | Fragile HTML; ToS / blocking; use as last-resort Stage A supplement |
| **snoowrap / Reddit official API** | “Free” only if app credentials still granted | Reddit API is approval-gated; confirm access before coding |

---

## 4. Owner checklist

1. Add **`SERPER_API_KEY`** first → retest discover endpoint with a store query; confirm Serper appears in `sourcesSearched`.  
2. Add `TAVILY_API_KEY`. Prefer **Serper + Tavily + Jina (no key)** while Zernio is cost-paused.  
3. **Leave `ZERNIO_*` empty** for zero Zernio cost (service skips). Re-add `ZERNIO_API_KEY` + `ZERNIO_REDDIT_ACCOUNT_ID` only when intentionally re-enabling paid social.  
4. Optionally `FIRECRAWL_API_KEY` before wiring Stage D upgrade (watch free-tier burn).  
5. Optional owner-desktop research: [Agent-Reach](https://github.com/Panniantong/Agent-Reach) — **not** production-wired yet; see §3a.  
6. Retest: discovery returns candidates **server-side only**; UI/API consumer shows **verified** codes only.  
7. Never invent or hardcode “verified” codes in docs, fixtures shown to users, or UI mocks.

---

## 5. Related docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — funnel & verify-only pipeline  
- [AGENTS.md](./AGENTS.md) — agent/service diagram  
- [README.md](./README.md) — quick start & env pointers  
- Code: `backend/src/discovery/orchestrator.ts`
