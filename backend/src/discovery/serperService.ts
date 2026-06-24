/**
 * Serper Service — real-time Google search via Serper.dev API
 * Free tier: 2,500 searches/month — no credit card required
 *
 * Searches Google for discount codes from multiple angles:
 * - General web (coupon sites, blogs, forums)
 * - Reddit specifically (highest signal for real codes)
 * - UAE/region-specific deal sites
 */

import 'dotenv/config';

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const SERPER_BASE_URL = 'https://google.serper.dev/search';

export interface SerperResult {
  title: string;
  link: string;
  snippet: string;
}

async function serperSearch(query: string, numResults: number = 10): Promise<SerperResult[]> {
  if (!SERPER_API_KEY) {
    console.warn('[Serper] No API key configured — skipping web search');
    return [];
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(SERPER_BASE_URL, {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: numResults }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[Serper] API error ${response.status}`);
      return [];
    }

    const data = await response.json();
    const organic: SerperResult[] = (data.organic || []).map((r: any) => ({
      title: r.title || '',
      link: r.link || '',
      snippet: r.snippet || '',
    }));

    // Also grab "answerBox" and "knowledgeGraph" if present — often has the code inline
    const extras: SerperResult[] = [];
    if (data.answerBox?.snippet) {
      extras.push({ title: 'Answer Box', link: data.answerBox.link || '', snippet: data.answerBox.snippet });
    }
    if (data.answerBox?.snippetHighlighted) {
      extras.push({ title: 'Answer Box Highlight', link: data.answerBox.link || '', snippet: data.answerBox.snippetHighlighted.join(' ') });
    }

    return [...extras, ...organic];

  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      console.error('[Serper] Error:', error);
    }
    return [];
  }
}

/**
 * Search for discount codes for a given store/brand.
 * Runs 4 targeted queries in parallel for maximum coverage.
 */
export async function searchForCodes(
  storeName: string,
  domain: string,
  region: string = 'GLOBAL',
): Promise<{ text: string; url: string; source: string }[]> {
  const regionTag = getRegionTag(region);

  // Build parallel queries — cover different source types
  const queries = [
    // 1. General coupon sites — RetailMeNot, Honey, Coupons.com
    `"${storeName}" promo code discount coupon ${new Date().getFullYear()}`,

    // 2. Reddit — highest signal for real codes
    `"${storeName}" promo code site:reddit.com`,

    // 3. Region-specific coupon sites
    `"${storeName}" discount code ${regionTag}`,

    // 4. Influencer/YouTube codes
    `"${storeName}" discount code influencer youtube 2025`,
  ];

  console.log(`[Serper] Running ${queries.length} searches for "${storeName}"...`);

  const results = await Promise.allSettled(queries.map(q => serperSearch(q, 8)));

  const sources: { text: string; url: string; source: string }[] = [];

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      for (const item of result.value) {
        if (item.snippet) {
          sources.push({
            text: `${item.title}\n${item.snippet}`,
            url: item.link,
            source: `Google Search: ${queries[i].slice(0, 50)}`,
          });
        }
      }
    }
  });

  console.log(`[Serper] Found ${sources.length} snippets across all queries`);
  return sources;
}

function getRegionTag(region: string): string {
  const tags: Record<string, string> = {
    'AE': 'UAE site:coupon.ae OR site:rezeem.ae OR site:grabon.ae',
    'SA': 'Saudi Arabia site:coupon.ae OR site:grabon.in',
    'UK': 'UK site:vouchercodes.co.uk OR site:myvouchercodes.co.uk',
    'US': 'USA site:retailmenot.com OR site:coupons.com',
    'AU': 'Australia site:groupon.com.au OR site:retailmenot.com',
    'DE': 'Germany site:gutscheinpony.de',
    'FR': 'France site:poulpeo.com',
    'GLOBAL': 'site:retailmenot.com OR site:coupon.com OR site:groupon.com',
  };
  return tags[region.toUpperCase()] || tags['GLOBAL'];
}
