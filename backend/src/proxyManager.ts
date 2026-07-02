// backend/src/proxyManager.ts
// Simple proxy manager that returns a proxy URL based on the requested region.
// It reads configuration from environment variables.
// Supported providers: BrightData, ScraperAPI, Crawlbase (select via PROXY_PROVIDER).

import dotenv from 'dotenv';
dotenv.config();

type ProxyProvider = 'brightdata' | 'scraperapi' | 'crawlbase' | '';

const provider: ProxyProvider = (process.env.PROXY_PROVIDER ?? '').toLowerCase() as ProxyProvider;
const apiKey = process.env.PROXY_API_KEY ?? '';

/**
 * Returns a proxy URL string suitable for Puppeteer launch args.
 * Example format: "http://username:password@proxyhost:port"
 */
export function getProxy(region: string): string | undefined {
  if (!provider || !apiKey) {
    console.warn('[ProxyManager] Proxy provider or API key not configured. Skipping proxy.');
    return undefined;
  }
  const encodedRegion = encodeURIComponent(region);
  switch (provider) {
    case 'brightdata':
      // BrightData format: http://login:password@zproxy.lum-superproxy.io:22225
      // The API key serves as the password; username is the CID (customer ID) which can be set via PROXY_USERNAME.
      const username = process.env.PROXY_USERNAME ?? '';
      return `http://${username}:${apiKey}@zproxy.lum-superproxy.io:22225?country=${encodedRegion}`;
    case 'scraperapi':
      // ScraperAPI format: http://proxy.scraperapi.com:8001?api_key=YOUR_KEY&country_code=US
      return `http://proxy.scraperapi.com:8001?api_key=${apiKey}&country_code=${encodedRegion}`;
    case 'crawlbase':
      // Crawlbase format: http://proxy.crawlbase.com:8010?token=YOUR_TOKEN&country=US
      return `http://proxy.crawlbase.com:8010?token=${apiKey}&country=${encodedRegion}`;
    default:
      console.warn(`[ProxyManager] Unknown provider "${provider}"`);
      return undefined;
  }
}
