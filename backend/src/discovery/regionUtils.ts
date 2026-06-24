/**
 * Region Utils — infers the likely geographic validity of a discount code
 * based on where it was discovered.
 *
 * Logic: source URL domain + subreddit name + search query context
 * → ISO country code or 'GLOBAL'
 */

// ── Domain → Region mapping ──────────────────────────────────────────────────

const DOMAIN_REGION_MAP: Record<string, string> = {
  // UAE / Gulf
  'coupon.ae': 'AE',
  'rezeem.ae': 'AE',
  'grabon.ae': 'AE',
  'voucherslug.ae': 'AE',
  'cobone.com': 'AE',
  'noon.com': 'AE',
  'namshi.com': 'AE',
  'talabat.com': 'AE',
  'amazon.ae': 'AE',
  'sharaf.ae': 'AE',
  '6thstreet.com': 'AE',
  'sivvi.com': 'AE',
  'ounass.ae': 'AE',

  // Saudi Arabia
  'amazon.sa': 'SA',
  'noon.sa': 'SA',

  // UK
  'vouchercodes.co.uk': 'GB',
  'myvouchercodes.co.uk': 'GB',
  'hotukdeals.com': 'GB',
  'vouchercloud.com': 'GB',
  'groupon.co.uk': 'GB',
  'amazon.co.uk': 'GB',
  'asos.com': 'GB',

  // US
  'retailmenot.com': 'US',
  'coupons.com': 'US',
  'couponfollow.com': 'US',
  'dealspotr.com': 'US',
  'slickdeals.net': 'US',
  'groupon.com': 'US',
  'amazon.com': 'US',

  // Germany
  'gutscheinpony.de': 'DE',
  'amazon.de': 'DE',

  // France
  'poulpeo.com': 'FR',
  'amazon.fr': 'FR',

  // Australia
  'groupon.com.au': 'AU',
  'amazon.com.au': 'AU',

  // Canada
  'amazon.ca': 'CA',
};

// ── Subreddit → Region mapping ───────────────────────────────────────────────

const SUBREDDIT_REGION_MAP: Record<string, string> = {
  'dubai': 'AE',
  'abudhabi': 'AE',
  'uae': 'AE',
  'saudiarabia': 'SA',
  'bahrain': 'BH',
  'qatar': 'QA',
  'kuwait': 'KW',
  'oman': 'OM',
  'unitedkingdom': 'GB',
  'uk': 'GB',
  'frugaluk': 'GB',
  'hotdeals': 'GB',
  'australia': 'AU',
  'canada': 'CA',
  'germany': 'DE',
  'france': 'FR',
  // Generic/global subreddits
  'deals': 'GLOBAL',
  'promocodes': 'GLOBAL',
  'coupons': 'GLOBAL',
  'frugal': 'GLOBAL',
  'freebies': 'GLOBAL',
  'buildapcsales': 'GLOBAL',
};

// ── Region metadata ──────────────────────────────────────────────────────────

export const REGION_META: Record<string, { flag: string; name: string }> = {
  'AE': { flag: '🇦🇪', name: 'UAE' },
  'SA': { flag: '🇸🇦', name: 'Saudi Arabia' },
  'GB': { flag: '🇬🇧', name: 'United Kingdom' },
  'US': { flag: '🇺🇸', name: 'United States' },
  'DE': { flag: '🇩🇪', name: 'Germany' },
  'FR': { flag: '🇫🇷', name: 'France' },
  'AU': { flag: '🇦🇺', name: 'Australia' },
  'CA': { flag: '🇨🇦', name: 'Canada' },
  'JP': { flag: '🇯🇵', name: 'Japan' },
  'KW': { flag: '🇰🇼', name: 'Kuwait' },
  'QA': { flag: '🇶🇦', name: 'Qatar' },
  'BH': { flag: '🇧🇭', name: 'Bahrain' },
  'OM': { flag: '🇴🇲', name: 'Oman' },
  'GLOBAL': { flag: '🌍', name: 'Global' },
};

// ── Main inference function ──────────────────────────────────────────────────

/**
 * Infer the likely geographic region a code is valid for,
 * based on where it was discovered.
 *
 * @param sourceUrl  The URL of the page where the code was found
 * @param sourceLabel  The human-readable source label
 * @param userRegion  The region the user searched from (fallback)
 * @returns ISO country code or 'GLOBAL'
 */
export function inferRegionFromSource(
  sourceUrl: string,
  sourceLabel: string,
  userRegion: string = 'GLOBAL',
): string {
  // 1. Try to match by source URL domain
  try {
    if (sourceUrl && sourceUrl.startsWith('http')) {
      const hostname = new URL(sourceUrl).hostname.replace(/^www\./, '');

      // Direct domain match
      if (DOMAIN_REGION_MAP[hostname]) {
        return DOMAIN_REGION_MAP[hostname];
      }

      // TLD match (.ae → AE, .co.uk → GB, .de → DE, etc.)
      if (hostname.endsWith('.ae')) return 'AE';
      if (hostname.endsWith('.co.uk')) return 'GB';
      if (hostname.endsWith('.de')) return 'DE';
      if (hostname.endsWith('.fr')) return 'FR';
      if (hostname.endsWith('.com.au')) return 'AU';
      if (hostname.endsWith('.ca')) return 'CA';
      if (hostname.endsWith('.sa')) return 'SA';
      if (hostname.endsWith('.co.jp')) return 'JP';
    }
  } catch {
    // Invalid URL — fall through
  }

  // 2. Try to match by subreddit name in source label
  // e.g. "Reddit feed: r/dubai" or "Reddit: r/deals"
  const subredditMatch = sourceLabel.match(/r\/([a-zA-Z0-9_]+)/i);
  if (subredditMatch) {
    const sub = subredditMatch[1].toLowerCase();
    if (SUBREDDIT_REGION_MAP[sub]) {
      return SUBREDDIT_REGION_MAP[sub];
    }
  }

  // 3. Check for region keywords in source label
  const labelLower = sourceLabel.toLowerCase();
  if (labelLower.includes('uae') || labelLower.includes('dubai') || labelLower.includes('.ae')) return 'AE';
  if (labelLower.includes('uk') || labelLower.includes('britain') || labelLower.includes('voucher')) return 'GB';
  if (labelLower.includes('us ') || labelLower.includes('usa') || labelLower.includes('retailmenot')) return 'US';
  if (labelLower.includes('saudi') || labelLower.includes('ksa') || labelLower.includes('.sa')) return 'SA';

  // 4. Tavily answer and generic Google results default to user's searched region
  if (sourceUrl === 'tavily:answer' || sourceLabel.includes('Google Search')) {
    return userRegion !== 'GLOBAL' ? userRegion : 'GLOBAL';
  }

  // 5. Fallback: GLOBAL (applies everywhere)
  return 'GLOBAL';
}

/**
 * Check if a discovered code's region is compatible with the user's search region.
 * GLOBAL codes are always compatible.
 */
export function isRegionCompatible(codeRegion: string, userRegion: string): boolean {
  if (codeRegion === 'GLOBAL') return true;
  if (userRegion === 'GLOBAL') return true;
  if (codeRegion === userRegion) return true;

  // Gulf Cooperation Council — codes often work cross-border
  const GCC = new Set(['AE', 'SA', 'KW', 'QA', 'BH', 'OM']);
  if (GCC.has(codeRegion) && GCC.has(userRegion)) return true;

  return false;
}

/**
 * Format a region code for display: "AE" → "🇦🇪 UAE"
 */
export function formatRegion(regionCode: string): string {
  const meta = REGION_META[regionCode];
  if (!meta) return regionCode;
  return `${meta.flag} ${meta.name}`;
}
