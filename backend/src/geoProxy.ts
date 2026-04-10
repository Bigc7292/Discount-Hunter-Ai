import type { GeoLocation, ProxyConfig } from './types.js';

const SUPPORTED_REGIONS: Record<string, GeoLocation> = {
  US: {
    code: 'US',
    country: 'United States',
    countryCode: 'US',
    region: 'North America',
    proxy: process.env.RESIDENTIAL_PROXY_API_KEY ? {
      host: 'brd.superproxy.io',
      port: 22225,
      username: `zone-residential-${process.env.RESIDENTIAL_PROXY_PROVIDER || 'us'}`,
      password: process.env.RESIDENTIAL_PROXY_API_KEY,
      provider: 'brightdata'
    } : undefined
  },
  UK: {
    code: 'UK',
    country: 'United Kingdom',
    countryCode: 'GB',
    region: 'Europe',
    proxy: process.env.RESIDENTIAL_PROXY_API_KEY ? {
      host: 'brd.superproxy.io',
      port: 22225,
      username: `zone-residential-uk`,
      password: process.env.RESIDENTIAL_PROXY_API_KEY,
      provider: 'brightdata'
    } : undefined
  },
  AE: {
    code: 'AE',
    country: 'United Arab Emirates',
    countryCode: 'AE',
    region: 'Middle East',
    proxy: process.env.RESIDENTIAL_PROXY_API_KEY ? {
      host: 'brd.superproxy.io',
      port: 22225,
      username: `zone-residential-ae`,
      password: process.env.RESIDENTIAL_PROXY_API_KEY,
      provider: 'brightdata'
    } : undefined
  },
  DE: {
    code: 'DE',
    country: 'Germany',
    countryCode: 'DE',
    region: 'Europe',
    proxy: process.env.RESIDENTIAL_PROXY_API_KEY ? {
      host: 'brd.superproxy.io',
      port: 22225,
      username: `zone-residential-de`,
      password: process.env.RESIDENTIAL_PROXY_API_KEY,
      provider: 'brightdata'
    } : undefined
  },
  FR: {
    code: 'FR',
    country: 'France',
    countryCode: 'FR',
    region: 'Europe',
    proxy: process.env.RESIDENTIAL_PROXY_API_KEY ? {
      host: 'brd.superproxy.io',
      port: 22225,
      username: `zone-residential-fr`,
      password: process.env.RESIDENTIAL_PROXY_API_KEY,
      provider: 'brightdata'
    } : undefined
  },
  GLOBAL: {
    code: 'GLOBAL',
    country: 'International',
    countryCode: 'XX',
    region: 'Global'
  }
};

export function getGeoLocation(regionCode: string): GeoLocation {
  const normalized = regionCode.toUpperCase();
  return SUPPORTED_REGIONS[normalized] || SUPPORTED_REGIONS['GLOBAL'];
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

export async function testProxyConnection(proxy: ProxyConfig): Promise<boolean> {
  if (!proxy) return false;
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

export function getRegionFromCountryCode(countryCode: string): string {
  const countryToRegion: Record<string, string> = {
    US: 'US', CA: 'US', MX: 'US',
    GB: 'UK', DE: 'EU', FR: 'EU', IT: 'EU', ES: 'EU', NL: 'EU', PL: 'EU',
    AE: 'AE', SA: 'AE', QA: 'AE', KW: 'AE', BH: 'AE',
    AU: 'AU', NZ: 'AU',
    JP: 'ASIA', KR: 'ASIA', CN: 'ASIA', HK: 'ASIA', SG: 'ASIA', IN: 'ASIA',
    BR: 'LATAM', AR: 'LATAM', CL: 'LATAM', CO: 'LATAM'
  };
  return countryToRegion[countryCode.toUpperCase()] || 'GLOBAL';
}