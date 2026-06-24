/**
 * Zernio Social Service — reads from all connected social platforms
 * via the Zernio API (single key covers Reddit, Twitter, TikTok, YouTube, Instagram)
 *
 * Key capabilities used for discovery:
 *   - reddit:search       → search r/deals, r/promocodes, r/coupons etc.
 *   - reddit:get-feed     → subreddit hot/new posts
 *   - inbox:comments      → comments across connected platforms
 */

import 'dotenv/config';

const ZERNIO_API_KEY = process.env.ZERNIO_API_KEY;
const ZERNIO_BASE = 'https://zernio.com/api/v1';
const REDDIT_ACCOUNT_ID = process.env.ZERNIO_REDDIT_ACCOUNT_ID;

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function zernioFetch(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs: number = 15000,
): Promise<any> {
  if (!ZERNIO_API_KEY) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${ZERNIO_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${ZERNIO_API_KEY}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[Zernio] ${endpoint} → ${response.status} ${response.statusText}`);
      return null;
    }

    return await response.json();

  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      console.error(`[Zernio] Error fetching ${endpoint}:`, (error as Error).message);
    }
    return null;
  }
}

// ── Reddit via Zernio ─────────────────────────────────────────────────────────

interface SocialResult {
  text: string;
  url: string;
  source: string;
}

/** Subreddits that consistently have real discount codes */
const CODE_SUBREDDITS = [
  'deals',
  'promocodes',
  'coupons',
  'frugal',
  'freebies',
  'buildapcsales',
];

const REGION_SUBREDDITS: Record<string, string[]> = {
  'AE': ['dubai', 'abudhabi', 'UAE', 'saudiarabia'],
  'SA': ['saudiarabia', 'dubai', 'UAE'],
  'UK': ['HotDeals', 'UKPersonalFinance', 'frugaluk'],
  'US': ['deals', 'extremecouponing', 'grocery'],
  'GLOBAL': ['deals', 'promocodes'],
};

/** Search Reddit via Zernio for promo codes */
async function searchReddit(
  storeName: string,
  subreddit?: string,
): Promise<SocialResult[]> {
  if (!REDDIT_ACCOUNT_ID) return [];

  const query = encodeURIComponent(`${storeName} promo code discount coupon`);
  const params = new URLSearchParams({
    accountId: REDDIT_ACCOUNT_ID,
    q: `${storeName} promo code discount`,
    sort: 'new',
    ...(subreddit ? { subreddit } : {}),
  });

  const data = await zernioFetch(`/reddit/search?${params}`);
  if (!data) return [];

  const posts: SocialResult[] = [];
  const items = data.posts || data.data || data.results || data.items || [];

  for (const post of items) {
    const text = [
      post.title || '',
      post.selftext || post.body || post.content || post.text || '',
    ].join('\n').trim();

    if (text && text.length > 10) {
      posts.push({
        text,
        url: post.url || post.permalink || `https://reddit.com${post.permalink}` || '',
        source: `Reddit: r/${post.subreddit || subreddit || 'search'}`,
      });
    }
  }

  return posts;
}

/** Get hot/new posts from a subreddit feed */
async function getSubredditFeed(subreddit: string, sort: 'hot' | 'new' = 'new'): Promise<SocialResult[]> {
  if (!REDDIT_ACCOUNT_ID) return [];

  const params = new URLSearchParams({
    accountId: REDDIT_ACCOUNT_ID,
    subreddit,
    sort,
    limit: '25',
  });

  const data = await zernioFetch(`/reddit/feed?${params}`);
  if (!data) return [];

  const posts: SocialResult[] = [];
  const items = data.posts || data.data || data.results || data.items || [];

  for (const post of items) {
    const text = [post.title || '', post.selftext || post.body || ''].join('\n').trim();
    if (text && text.length > 10) {
      posts.push({
        text,
        url: post.url || `https://reddit.com${post.permalink || ''}`,
        source: `Reddit feed: r/${subreddit}`,
      });
    }
  }

  return posts;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Search all connected social platforms for discount codes for a brand.
 * Parallel execution — if one source times out the rest continue.
 */
export async function searchSocialMedia(
  storeName: string,
  domain: string,
  region: string = 'GLOBAL',
): Promise<SocialResult[]> {
  if (!ZERNIO_API_KEY) {
    console.warn('[Zernio] No API key configured — skipping social media search');
    return [];
  }

  console.log(`[Zernio] Searching social media for "${storeName}" (${region})...`);

  // Determine which subreddits to search
  const regionSubs = REGION_SUBREDDITS[region.toUpperCase()] || REGION_SUBREDDITS['GLOBAL'];
  const allSubs = [...new Set([...CODE_SUBREDDITS.slice(0, 3), ...regionSubs])];

  // Run searches in parallel
  const tasks = [
    // General Reddit search (no subreddit filter)
    searchReddit(storeName),

    // Brand-specific Reddit search
    searchReddit(storeName, storeName.toLowerCase().replace(/[^a-z]/g, '')),

    // Search in deal subreddits
    ...allSubs.slice(0, 3).map(sub => searchReddit(storeName, sub)),

    // Subreddit feeds for deal-specific subs
    getSubredditFeed('promocodes', 'new'),
    getSubredditFeed('deals', 'hot'),
  ];

  const settled = await Promise.allSettled(tasks);

  const results: SocialResult[] = [];
  for (const r of settled) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      results.push(...r.value);
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const deduped = results.filter(r => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  console.log(`[Zernio] Found ${deduped.length} social posts`);
  return deduped;
}
