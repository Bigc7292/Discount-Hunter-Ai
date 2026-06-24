/**
 * Discovery Orchestrator — the brain of the real-time code discovery pipeline
 *
 * Runs all discovery sources in PARALLEL:
 *   1. Serper (Google search)     → fast, broad coverage
 *   2. Jina (coupon page scraper) → deep, structured coupon pages
 *   3. Zernio (Reddit + social)   → community-verified, real codes
 *   4. Tavily (AI search)         → deep content for influencer codes
 *
 * Then extracts codes from ALL collected text using the code extractor.
 * Returns deduplicated candidates sorted by confidence.
 */

import { searchForCodes as serperSearch } from './serperService.js';
import { scrapeCouponPages, scrapeUrls } from './jinaService.js';
import { searchSocialMedia } from './zernioService.js';
import { tavilySearchForCodes } from './tavilyService.js';
import { extractCodes, CandidateCode } from './codeExtractor.js';
import { isRegionCompatible } from './regionUtils.js';

export interface DiscoveryResult {
  candidates: CandidateCode[];
  sourcesSearched: string[];
  totalTextsAnalysed: number;
  durationMs: number;
  storeName: string;
  domain: string;
}

/**
 * Infer the domain from a store name / URL query.
 * e.g. "Amazon UAE" → "amazon.ae", "Amazon" → "amazon.com"
 */
function inferDomain(storeName: string, region: string): string {
  const name = storeName.toLowerCase().replace(/\s+(uae|ae|uk|us|usa|au|australia|saudi|ksa|canada|ca|de|fr|jp).*$/i, '').trim();
  const cleanName = name.replace(/[^a-z0-9]/g, '');

  const regionTlds: Record<string, string> = {
    'AE': '.ae', 'SA': '.sa', 'UK': '.co.uk', 'GB': '.co.uk',
    'AU': '.com.au', 'DE': '.de', 'FR': '.fr', 'JP': '.co.jp',
    'CA': '.ca', 'IN': '.in',
  };

  const tld = regionTlds[region.toUpperCase()] || '.com';

  // Known stores with non-obvious domains
  const knownDomains: Record<string, Record<string, string>> = {
    'amazon': { 'AE': 'amazon.ae', 'UK': 'amazon.co.uk', 'DE': 'amazon.de', 'default': 'amazon.com' },
    'noon': { 'default': 'noon.com' },
    'namshi': { 'default': 'namshi.com' },
    'talabat': { 'default': 'talabat.com' },
    'deliveroo': { 'default': 'deliveroo.com' },
    'careem': { 'default': 'careem.com' },
    'nike': { 'default': 'nike.com' },
    'adidas': { 'default': 'adidas.com' },
    'samsung': { 'default': 'samsung.com' },
    'apple': { 'default': 'apple.com' },
    'zara': { 'default': 'zara.com' },
    'hm': { 'default': 'hm.com' },
    'cinema': { 'AE': 'voxcinemas.com', 'UK': 'odeon.co.uk', 'default': 'fandango.com' },
    'vue': { 'default': 'vue.com' },
    'vox': { 'default': 'voxcinemas.com' },
  };

  const domainMap = knownDomains[cleanName];
  if (domainMap) {
    return domainMap[region.toUpperCase()] || domainMap['default'];
  }

  return `${cleanName}${tld}`;
}

/**
 * Parse the store name from a user query.
 * e.g. "Amazon UAE discount codes" → "Amazon"
 * e.g. "cinema tickets uae" → "cinema"
 */
function parseStoreName(query: string): string {
  return query
    .replace(/\b(discount|promo|coupon|code|codes|voucher|deal|deals|offers?|uae|uk|us|usa|au|saudi|ksa|ca)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')[0] || query.split(' ')[0];
}

/**
 * Run the full multi-source discovery pipeline for a search query.
 */
export async function discoverCodes(
  query: string,
  region: string = 'US',
): Promise<DiscoveryResult> {
  const startTime = Date.now();
  const storeName = parseStoreName(query);
  const domain = inferDomain(query, region);
  const sourcesSearched: string[] = [];

  console.log(`\n🔍 DISCOVERY START: "${storeName}" | domain: ${domain} | region: ${region}`);

  // ── PHASE 1: Parallel source collection ─────────────────────────────────────
  console.log('[Orchestrator] Phase 1: Running all sources in parallel...');

  const [serperResults, jinaResults, socialResults, tavilyResults] = await Promise.allSettled([
    serperSearch(storeName, domain, region),
    scrapeCouponPages(storeName, domain, region, 6),
    searchSocialMedia(storeName, domain, region),
    tavilySearchForCodes(storeName, domain, region),
  ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : []));

  // Track what ran successfully
  if ((serperResults as any[]).length > 0) sourcesSearched.push('Google Search (Serper)');
  if ((jinaResults as any[]).length > 0) sourcesSearched.push('Coupon Page Scraper (Jina)');
  if ((socialResults as any[]).length > 0) sourcesSearched.push('Reddit & Social (Zernio)');
  if ((tavilyResults as any[]).length > 0) sourcesSearched.push('AI Web Search (Tavily)');

  // ── PHASE 2: Scrape top URLs from Serper results ──────────────────────────
  const serperUrls = (serperResults as any[])
    .map((r: any) => r.url)
    .filter(u => u && u.startsWith('http') && !u.includes('reddit.com'))
    .slice(0, 4);

  const scrapedSerperPages = serperUrls.length > 0
    ? await scrapeUrls(serperUrls, 4)
    : [];

  if (scrapedSerperPages.length > 0) sourcesSearched.push('Scraped Search Results (Jina)');

  // ── PHASE 3: Aggregate all text sources ──────────────────────────────────
  const allSources = [
    ...(serperResults as any[]),
    ...(jinaResults as any[]),
    ...(socialResults as any[]),
    ...(tavilyResults as any[]),
    ...scrapedSerperPages,
  ] as Array<{ text: string; url: string; source: string }>;

  console.log(`[Orchestrator] Collected ${allSources.length} text sources total`);

  // ── PHASE 4: Extract codes from all text ─────────────────────────────────
  console.log('[Orchestrator] Phase 2: Extracting codes from all sources...');

  const codeMap = new Map<string, CandidateCode>();
  const allExtracted = await Promise.allSettled(
    allSources.map(s =>
      extractCodes(s.text, storeName, s.source, s.url, region)
    )
  );

  for (const result of allExtracted) {
    if (result.status !== 'fulfilled') continue;
    for (const candidate of result.value) {
      const existing = codeMap.get(candidate.code);
      if (!existing) {
        codeMap.set(candidate.code, candidate);
      } else {
        // Upgrade confidence if found in multiple sources
        if (candidate.confidence === 'high' || (candidate.confidence === 'medium' && existing.confidence === 'low')) {
          existing.confidence = candidate.confidence;
        }
        // Keep highest-quality description
        if (candidate.description && candidate.description.length > existing.description.length) {
          existing.description = candidate.description;
        }
        if (candidate.discount) existing.discount = candidate.discount;
        if (candidate.expiry) existing.expiry = candidate.expiry;
      }
    }
  }

  // ── PHASE 5: Sort, filter by region compatibility, and return ─────────────
  const confidenceOrder = { high: 0, medium: 1, low: 2 };
  const candidates = [...codeMap.values()]
    .filter(c => {
      // Always include GLOBAL and exact region matches
      // Filter out codes from incompatible regions (e.g. UK-only code for UAE user)
      const compatible = isRegionCompatible(c.likelyRegion, region);
      if (!compatible) {
        console.log(`  [Filter] Dropping ${c.code} (${c.likelyRegion}) — incompatible with user region ${region}`);
      }
      return compatible;
    })
    .sort((a, b) => {
      // Primary: confidence
      const confDiff = confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
      if (confDiff !== 0) return confDiff;
      // Secondary: exact region match before GLOBAL
      if (a.likelyRegion === region && b.likelyRegion !== region) return -1;
      if (b.likelyRegion === region && a.likelyRegion !== region) return 1;
      return 0;
    })
    .slice(0, 20);

  const durationMs = Date.now() - startTime;

  console.log(`✅ DISCOVERY COMPLETE: ${candidates.length} candidates found in ${durationMs}ms`);
  console.log(`   High confidence: ${candidates.filter(c => c.confidence === 'high').length}`);
  console.log(`   Medium confidence: ${candidates.filter(c => c.confidence === 'medium').length}`);
  console.log(`   Low confidence: ${candidates.filter(c => c.confidence === 'low').length}`);
  console.log(`   Sources: ${sourcesSearched.join(', ')}`);

  return {
    candidates,
    sourcesSearched,
    totalTextsAnalysed: allSources.length,
    durationMs,
    storeName,
    domain,
  };
}
