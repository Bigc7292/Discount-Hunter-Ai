/**
 * Jina Reader Service — converts any URL to clean markdown
 * FREE — no API key needed, 20 requests/minute on anonymous tier
 *
 * Used to scrape coupon aggregator pages:
 * - retailmenot.com/view/STORE
 * - coupon.ae/STORE
 * - rezeem.ae/STORE
 * - vouchercodes.co.uk/STORE
 * - Any URL that Serper returns as a top result
 */

const JINA_BASE = 'https://r.jina.ai/';
const REQUEST_TIMEOUT_MS = 20000;

interface JinaResult {
  text: string;
  url: string;
  source: string;
}

/**
 * Scrape a single URL via Jina Reader → clean markdown text
 */
async function scrapeUrl(url: string): Promise<string | null> {
  try {
    const jinaUrl = `${JINA_BASE}${url}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/plain',
        'X-Return-Format': 'markdown',
        // Remove scripts, nav, ads for cleaner coupon text
        'X-Remove-Selector': 'nav,footer,header,script,style,iframe,.ad,.advertisement,.cookie-banner',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const text = await response.text();
    // Truncate to save processing time — coupon codes appear in first ~4KB
    return text.slice(0, 6000);

  } catch {
    return null;
  }
}

/**
 * Build coupon page URLs for a store across major aggregator sites
 */
function buildCouponPageUrls(storeName: string, domain: string, region: string): string[] {
  const slug = storeName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const domainSlug = domain.replace(/^www\./, '').replace(/\.[a-z]+$/, '');

  const urls: string[] = [];

  // Always scrape these global sites
  urls.push(
    `https://www.retailmenot.com/view/${domain}`,
    `https://www.groupon.com/coupons/${slug}`,
    `https://slickdeals.net/coupons/${slug}/`,
  );

  // Region-specific coupon sites
  const uaeUrls = [
    `https://coupon.ae/${slug}`,
    `https://rezeem.ae/${slug}/`,
    `https://grabon.ae/${slug}-coupons/`,
    `https://www.voucherslug.ae/${slug}-coupons`,
  ];

  const ukUrls = [
    `https://www.vouchercodes.co.uk/${domain}/`,
    `https://www.myvouchercodes.co.uk/${slug}/`,
    `https://www.hotukdeals.com/search?q=${encodeURIComponent(storeName)}`,
  ];

  const usUrls = [
    `https://www.coupons.com/coupon-codes/${slug}/`,
    `https://www.couponfollow.com/site/${domain}`,
    `https://dealspotr.com/promo-codes/${domain}`,
  ];

  switch (region.toUpperCase()) {
    case 'AE':
    case 'SA':
    case 'KW':
    case 'QA':
    case 'BH':
    case 'OM':
      urls.push(...uaeUrls);
      break;
    case 'UK':
    case 'GB':
      urls.push(...ukUrls);
      break;
    default:
      urls.push(...usUrls);
  }

  return urls;
}

/**
 * Scrape top coupon pages for a store — runs in parallel with 5s stagger
 * to stay within Jina's 20 req/min rate limit
 */
export async function scrapeCouponPages(
  storeName: string,
  domain: string,
  region: string = 'US',
  maxPages: number = 5,
): Promise<JinaResult[]> {
  const urls = buildCouponPageUrls(storeName, domain, region).slice(0, maxPages);

  console.log(`[Jina] Scraping ${urls.length} coupon pages for "${storeName}"...`);

  // Stagger requests slightly to be polite
  const results: JinaResult[] = [];
  const chunks = [];
  for (let i = 0; i < urls.length; i += 3) {
    chunks.push(urls.slice(i, i + 3));
  }

  for (const chunk of chunks) {
    const settled = await Promise.allSettled(
      chunk.map(url => scrapeUrl(url).then(text => ({ text, url })))
    );

    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value.text) {
        results.push({
          text: r.value.text,
          url: r.value.url,
          source: `Jina scrape: ${new URL(r.value.url).hostname}`,
        });
      }
    }

    // Brief pause between chunks
    if (chunks.indexOf(chunk) < chunks.length - 1) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  console.log(`[Jina] Successfully scraped ${results.length}/${urls.length} pages`);
  return results;
}

/**
 * Scrape a specific list of URLs (from Serper results)
 */
export async function scrapeUrls(
  urls: string[],
  maxUrls: number = 5,
): Promise<JinaResult[]> {
  const filtered = urls
    .filter(u => u.startsWith('http'))
    .filter(u => !u.includes('reddit.com')) // Reddit pages don't scrape well via Jina
    .slice(0, maxUrls);

  const results = await Promise.allSettled(
    filtered.map(url => scrapeUrl(url).then(text => ({ text, url })))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<{ text: string | null; url: string }> =>
      r.status === 'fulfilled' && r.value.text !== null
    )
    .map(r => ({
      text: r.value.text as string,
      url: r.value.url,
      source: `Jina scrape: ${new URL(r.value.url).hostname}`,
    }));
}
