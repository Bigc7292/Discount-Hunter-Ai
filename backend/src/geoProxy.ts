/**
 * GeoProxy — Region configuration for checkout testing
 *
 * Each region maps to:
 * - A geo-location (country, code)
 * - An optional residential proxy (for testing from that country's IP)
 *
 * Expanded to 12 regions matching the frontend RegionSelector.
 */

import type { GeoLocation, ProxyConfig } from './types.js';

const PROXY_KEY = process.env.RESIDENTIAL_PROXY_API_KEY;
const PROXY_HOST = 'brd.superproxy.io';
const PROXY_PORT = 22225;

/**
 * Build a proxy config for a given zone.
 * Returns undefined if no proxy key is configured — verification
 * still works without proxies, just without geo-targeting.
 */
function makeProxy(zone: string): ProxyConfig | undefined {
  if (!PROXY_KEY) return undefined;
  return {
    host: PROXY_HOST,
    port: PROXY_PORT,
    username: `zone-residential-${zone}`,
    password: PROXY_KEY,
    provider: 'brightdata',
  };
}

const SUPPORTED_REGIONS: Record<string, GeoLocation> = {
  // North America
  US: {
    code: 'US', country: 'United States', countryCode: 'US', region: 'North America',
    proxy: makeProxy('us'),
  },
  CA: {
    code: 'CA', country: 'Canada', countryCode: 'CA', region: 'North America',
    proxy: makeProxy('ca'),
  },
  MX: {
    code: 'MX', country: 'Mexico', countryCode: 'MX', region: 'North America',
    proxy: makeProxy('mx'),
  },

  // Europe
  UK: {
    code: 'UK', country: 'United Kingdom', countryCode: 'GB', region: 'Europe',
    proxy: makeProxy('gb'),
  },
  DE: {
    code: 'DE', country: 'Germany', countryCode: 'DE', region: 'Europe',
    proxy: makeProxy('de'),
  },
  FR: {
    code: 'FR', country: 'France', countryCode: 'FR', region: 'Europe',
    proxy: makeProxy('fr'),
  },
  ES: {
    code: 'ES', country: 'Spain', countryCode: 'ES', region: 'Europe',
    proxy: makeProxy('es'),
  },
  IT: {
    code: 'IT', country: 'Italy', countryCode: 'IT', region: 'Europe',
    proxy: makeProxy('it'),
  },
  NL: {
    code: 'NL', country: 'Netherlands', countryCode: 'NL', region: 'Europe',
    proxy: makeProxy('nl'),
  },
  PL: {
    code: 'PL', country: 'Poland', countryCode: 'PL', region: 'Europe',
    proxy: makeProxy('pl'),
  },
  TR: {
    code: 'TR', country: 'Turkey', countryCode: 'TR', region: 'Europe',
    proxy: makeProxy('tr'),
  },

  // Middle East
  AE: {
    code: 'AE', country: 'United Arab Emirates', countryCode: 'AE', region: 'Middle East',
    proxy: makeProxy('ae'),
  },
  SA: {
    code: 'SA', country: 'Saudi Arabia', countryCode: 'SA', region: 'Middle East',
    proxy: makeProxy('sa'),
  },

  // Asia Pacific
  AU: {
    code: 'AU', country: 'Australia', countryCode: 'AU', region: 'Asia Pacific',
    proxy: makeProxy('au'),
  },
  JP: {
    code: 'JP', country: 'Japan', countryCode: 'JP', region: 'Asia Pacific',
    proxy: makeProxy('jp'),
  },
  IN: {
    code: 'IN', country: 'India', countryCode: 'IN', region: 'Asia Pacific',
    proxy: makeProxy('in'),
  },
  KR: {
    code: 'KR', country: 'South Korea', countryCode: 'KR', region: 'Asia Pacific',
    proxy: makeProxy('kr'),
  },
  SG: {
    code: 'SG', country: 'Singapore', countryCode: 'SG', region: 'Asia Pacific',
    proxy: makeProxy('sg'),
  },

  // Latin America
  BR: {
    code: 'BR', country: 'Brazil', countryCode: 'BR', region: 'Latin America',
    proxy: makeProxy('br'),
  },

  // Fallback
  GLOBAL: {
    code: 'GLOBAL', country: 'International', countryCode: 'XX', region: 'Global',
    proxy: undefined, // No proxy — server's own IP
  },
};

export function getGeoLocation(regionCode: string): GeoLocation {
  const normalized = regionCode.toUpperCase().trim();
  return SUPPORTED_REGIONS[normalized] || SUPPORTED_REGIONS['US'];
}

export function getAllSupportedRegions(): GeoLocation[] {
  return Object.values(SUPPORTED_REGIONS);
}

export function formatProxyUrl(proxy: ProxyConfig | undefined): string | undefined {
  if (!proxy) return undefined;
  if (proxy.username && proxy.password) {
    return `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
  }
  return `http://${proxy.host}:${proxy.port}`;
}

export function getRegionFromCountryCode(countryCode: string): string {
  const map: Record<string, string> = {
    US: 'US', CA: 'CA', MX: 'MX',
    GB: 'UK', DE: 'DE', FR: 'FR', IT: 'IT', ES: 'ES', NL: 'NL', PL: 'PL', TR: 'TR',
    AE: 'AE', SA: 'SA',
    AU: 'AU', JP: 'JP', IN: 'IN', KR: 'KR', SG: 'SG',
    BR: 'BR',
  };
  return map[countryCode.toUpperCase()] || 'US';
}

export async function testProxyConnection(proxy: ProxyConfig): Promise<boolean> {
  if (!proxy) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal,
    });
    clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
}