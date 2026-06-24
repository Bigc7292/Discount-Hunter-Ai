/**
 * Tavily Service — AI-native web search designed for agent pipelines
 * Free tier: 1,000 searches/month — no credit card required
 *
 * Unlike Serper (which returns snippets), Tavily can return full page content.
 * Used for: deep content extraction from coupon pages + deal forums
 */

import 'dotenv/config';

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const TAVILY_BASE = 'https://api.tavily.com/search';

interface TavilyResult {
  text: string;
  url: string;
  source: string;
}

async function tavilySearch(
  query: string,
  options: {
    searchDepth?: 'basic' | 'advanced';
    maxResults?: number;
    includeRawContent?: boolean;
  } = {},
): Promise<TavilyResult[]> {
  if (!TAVILY_API_KEY) return [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(TAVILY_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        api_key: TAVILY_API_KEY,
        search_depth: options.searchDepth || 'basic',
        max_results: options.maxResults || 8,
        include_raw_content: options.includeRawContent || false,
        include_answer: true,
        include_domains: [],
        exclude_domains: ['amazon.com', 'ebay.com', 'walmart.com'], // Skip the stores themselves
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[Tavily] API error ${response.status}`);
      return [];
    }

    const data = await response.json();
    const results: TavilyResult[] = [];

    // Include the AI-generated answer if it contains code patterns
    if (data.answer && data.answer.length > 10) {
      results.push({
        text: data.answer,
        url: 'tavily:answer',
        source: 'Tavily AI Answer',
      });
    }

    // Include page results
    for (const r of (data.results || [])) {
      const text = [r.title || '', r.content || r.raw_content || ''].join('\n').trim();
      if (text.length > 20) {
        results.push({
          text: text.slice(0, 4000),
          url: r.url || '',
          source: `Tavily: ${new URL(r.url || 'https://example.com').hostname}`,
        });
      }
    }

    return results;

  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      console.error('[Tavily] Error:', error);
    }
    return [];
  }
}

/**
 * Run targeted Tavily searches for a brand's discount codes.
 * More expensive (uses more of free quota) so we run fewer queries vs Serper.
 */
export async function tavilySearchForCodes(
  storeName: string,
  domain: string,
  region: string = 'GLOBAL',
): Promise<TavilyResult[]> {
  if (!TAVILY_API_KEY) {
    console.warn('[Tavily] No API key configured — skipping');
    return [];
  }

  console.log(`[Tavily] Searching for "${storeName}" codes...`);

  const queries = [
    // Forum and community discussions with actual codes shared
    `${storeName} discount code coupon working ${new Date().getFullYear()} reddit forum`,
    // Influencer/affiliate codes (YouTube, TikTok descriptions)
    `${storeName} promo code influencer affiliate creator code`,
  ];

  const results = await Promise.allSettled(queries.map(q => tavilySearch(q, { maxResults: 6 })));

  const allResults: TavilyResult[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') allResults.push(...r.value);
  }

  console.log(`[Tavily] Found ${allResults.length} results`);
  return allResults;
}
