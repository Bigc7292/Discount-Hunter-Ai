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
| **Zernio** | `zernioService.ts` | Reddit search/feeds via Zernio (intended path for X/IG/TikTok/YouTube when accounts connected) | `ZERNIO_API_KEY` + `ZERNIO_REDDIT_ACCOUNT_ID` | Yes — Phase 1 parallel |
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
| `TAVILY_API_KEY` | Tavily | 2 |
| `ZERNIO_API_KEY` | Zernio social | 3 |
| `ZERNIO_REDDIT_ACCOUNT_ID` | Zernio Reddit | 3 (with Zernio) |
| `FIRECRAWL_API_KEY` | Firecrawl (optional Stage D upgrade) | 4 |
| `NVIDIA_API_KEY` | LLM extract pass (regex works without) | 5 |

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

### Stage C — Social (owner: Zernio)

- **Adapter:** `zernioService.searchSocialMedia`
- **Today:** Reddit search + feeds (`promocodes`, `deals`, region subs)
- **Intended expansion (same key):** X / Instagram / TikTok / YouTube when Zernio accounts connected — still candidates only
- **Output:** post/comment text + permalinks

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
| 5 | **[not-an-aardvark/snoowrap](https://github.com/not-an-aardvark/snoowrap)** (MIT) or Reddit official API | MIT; requires Reddit app credentials / ToS | **Fallback if Zernio gaps.** Prefer Zernio multi-platform first; snoowrap for Reddit-only resilience. |

**Honorable mentions (do not rush):** [exa-labs/exa-mcp-server](https://github.com/exa-labs/exa-mcp-server) (MIT) for semantic web search; Brave Search API (commercial) as Serper alternative; PRAW (BSD-2-Clause) if any Python sidecars appear. Avoid unaudited “coupon scraper” npm packages.

---

## 4. Owner checklist

1. Add **`SERPER_API_KEY`** first → retest discover endpoint with a store query; confirm Serper appears in `sourcesSearched`.  
2. Add `TAVILY_API_KEY`, then `ZERNIO_API_KEY` + `ZERNIO_REDDIT_ACCOUNT_ID`.  
3. Optionally `FIRECRAWL_API_KEY` before wiring Stage D upgrade.  
4. Retest: discovery returns candidates **server-side only**; UI/API consumer shows **verified** codes only.  
5. Never invent or hardcode “verified” codes in docs, fixtures shown to users, or UI mocks.

---

## 5. Related docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — funnel & verify-only pipeline  
- [AGENTS.md](./AGENTS.md) — agent/service diagram  
- [README.md](./README.md) — quick start & env pointers  
- Code: `backend/src/discovery/orchestrator.ts`
