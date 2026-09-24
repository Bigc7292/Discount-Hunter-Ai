/**
 * GeoProxy — Region configuration for checkout testing
 *
 * Each region maps to:
 * - A geo-location (country, code)
 * - An optional residential proxy (for testing from that country's IP)
 *
 * Bright Data-style rotating residential proxies:
 * - RESIDENTIAL_PROXY_API_KEY = password (required for geo proxy)
 * - RESIDENTIAL_PROXY_CUSTOMER = Bright Data customer id (optional; enables brd-customer-… username)
 * - RESIDENTIAL_PROXY_ZONE = zone name (default: residential)
 * - RESIDENTIAL_PROXY_HOST / RESIDENTIAL_PROXY_PORT (defaults: brd.superproxy.io / 22225)
 *
 * Per verify-batch session rotation: username includes `-session-{random}` so each hunt
 * gets a fresh residential IP while staying in the chosen country.
 *
 * Expanded to regions matching the frontend RegionSelector.
 */

import { randomBytes } from 'crypto';
import type { GeoLocation, ProxyConfig } from './types.js';

function proxyPassword(): string | undefined {
  const key = process.env.RESIDENTIAL_PROXY_API_KEY?.trim();
  return key || undefined;
}

function proxyHost(): string {
  return process.env.RESIDENTIAL_PROXY_HOST?.trim() || 'brd.superproxy.io';
}

function proxyPort(): number {
  const raw = process.env.RESIDENTIAL_PROXY_PORT?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 22225;
  return Number.isFinite(n) && n > 0 ? n : 22225;
}

function proxyZone(): string {
  return process.env.RESIDENTIAL_PROXY_ZONE?.trim() || 'residential';
}

function proxyCustomer(): string | undefined {
  const c = process.env.RESIDENTIAL_PROXY_CUSTOMER?.trim();
  return c || undefined;
}

/** Whether a geo residential proxy password is configured (env PROXY_SERVER is separate). */
export function isGeoProxyConfigured(): boolean {
  return !!proxyPassword();
}

/** Short random session id for Bright Data sticky/rotate (unique per verify batch). */
export function newProxySessionId(): string {
  return randomBytes(8).toString('hex');
}

/**
 * Build Bright Data (or compatible) username.
 *
 * If RESIDENTIAL_PROXY_CUSTOMER is set:
 *   brd-customer-{customer}-zone-{zone}-country-{cc}-session-{session}
 * Else (backward-compatible base, with optional session for rotation):
 *   zone-residential-{cc}
 *   zone-residential-{cc}-session-{session}
 */
export function buildProxyUsername(
  countryCodeLower: string,
  sessionId?: string
): string {
  const cc = countryCodeLower.toLowerCase();
  const zone = proxyZone();
  const customer = proxyCustomer();
  const session = sessionId?.trim();

  if (customer) {
    let user = `brd-customer-${customer}-zone-${zone}-country-${cc}`;
    if (session) user += `-session-${session}`;
    return user;
  }

  // Backward-compatible format used before customer id was configurable
  let user = `zone-residential-${cc}`;
  if (session) user += `-session-${session}`;
  // If zone != residential and no customer, still prefer documented zone in username
  if (zone && zone !== 'residential') {
    user = session
      ? `zone-${zone}-${cc}-session-${session}`
      : `zone-${zone}-${cc}`;
  }
  return user;
}

/**
 * Build a proxy config for a given ISO country code (lowercase, e.g. us, gb, ae).
 * Returns undefined if no proxy key is configured — verification still works
 * without proxies, just without geo-targeting.
 */
export function makeProxy(
  countryCodeLower: string,
  sessionId?: string
): ProxyConfig | undefined {
  const password = proxyPassword();
  if (!password) return undefined;
  return {
    host: proxyHost(),
    port: proxyPort(),
    username: buildProxyUsername(countryCodeLower, sessionId),
    password,
    provider: process.env.RESIDENTIAL_PROXY_PROVIDER?.trim() || 'brightdata',
  };
}

interface RegionDef {
  code: string;
  country: string;
  countryCode: string;
  region: string;
  /** Bright Data / ISO country slug for proxy username (us, gb, ae, …) */
  proxyCountry: string | null;
}

const REGION_DEFS: RegionDef[] = [
  // North America
  { code: 'US', country: 'United States', countryCode: 'US', region: 'North America', proxyCountry: 'us' },
  { code: 'CA', country: 'Canada', countryCode: 'CA', region: 'North America', proxyCountry: 'ca' },
  { code: 'MX', country: 'Mexico', countryCode: 'MX', region: 'North America', proxyCountry: 'mx' },
  // Europe
  { code: 'UK', country: 'United Kingdom', countryCode: 'GB', region: 'Europe', proxyCountry: 'gb' },
  { code: 'DE', country: 'Germany', countryCode: 'DE', region: 'Europe', proxyCountry: 'de' },
  { code: 'FR', country: 'France', countryCode: 'FR', region: 'Europe', proxyCountry: 'fr' },
  { code: 'ES', country: 'Spain', countryCode: 'ES', region: 'Europe', proxyCountry: 'es' },
  { code: 'IT', country: 'Italy', countryCode: 'IT', region: 'Europe', proxyCountry: 'it' },
  { code: 'NL', country: 'Netherlands', countryCode: 'NL', region: 'Europe', proxyCountry: 'nl' },
  { code: 'PL', country: 'Poland', countryCode: 'PL', region: 'Europe', proxyCountry: 'pl' },
  { code: 'TR', country: 'Turkey', countryCode: 'TR', region: 'Europe', proxyCountry: 'tr' },
  // Middle East
  { code: 'AE', country: 'United Arab Emirates', countryCode: 'AE', region: 'Middle East', proxyCountry: 'ae' },
  { code: 'SA', country: 'Saudi Arabia', countryCode: 'SA', region: 'Middle East', proxyCountry: 'sa' },
  // Asia Pacific
  { code: 'AU', country: 'Australia', countryCode: 'AU', region: 'Asia Pacific', proxyCountry: 'au' },
  { code: 'JP', country: 'Japan', countryCode: 'JP', region: 'Asia Pacific', proxyCountry: 'jp' },
  { code: 'IN', country: 'India', countryCode: 'IN', region: 'Asia Pacific', proxyCountry: 'in' },
  { code: 'KR', country: 'South Korea', countryCode: 'KR', region: 'Asia Pacific', proxyCountry: 'kr' },
  { code: 'SG', country: 'Singapore', countryCode: 'SG', region: 'Asia Pacific', proxyCountry: 'sg' },
  // Latin America
  { code: 'BR', country: 'Brazil', countryCode: 'BR', region: 'Latin America', proxyCountry: 'br' },
  // Fallback — no proxy (server's own IP)
  { code: 'GLOBAL', country: 'International', countryCode: 'XX', region: 'Global', proxyCountry: null },
];

const REGION_BY_CODE: Record<string, RegionDef> = Object.fromEntries(
  REGION_DEFS.map(r => [r.code, r])
);

export interface GetGeoOptions {
  /**
   * When true (verify batches), attach a unique -session-{id} so Bright Data
   * rotates to a fresh residential IP for this hunt while keeping country match.
   */
  rotateSession?: boolean;
  /** Explicit session id (tests); otherwise random when rotateSession is true. */
  sessionId?: string;
}

/**
 * Resolve geo + optional ProxyConfig for a frontend region code (US, UK, AE, …).
 * Proxy is built per call (not at module load) so env + session rotation apply.
 */
export function getGeoLocation(
  regionCode: string,
  opts: GetGeoOptions = {}
): GeoLocation {
  const normalized = regionCode.toUpperCase().trim();
  const def = REGION_BY_CODE[normalized] || REGION_BY_CODE['US'];
  const rotate = opts.rotateSession === true;
  const sessionId =
    def.proxyCountry && (rotate || opts.sessionId)
      ? (opts.sessionId || (rotate ? newProxySessionId() : undefined))
      : undefined;

  return {
    code: def.code,
    country: def.country,
    countryCode: def.countryCode,
    region: def.region,
    proxy: def.proxyCountry
      ? makeProxy(def.proxyCountry, sessionId)
      : undefined,
  };
}

export function getAllSupportedRegions(): GeoLocation[] {
  // Snapshot without rotating sessions (list/health only)
  return REGION_DEFS.map(def => ({
    code: def.code,
    country: def.country,
    countryCode: def.countryCode,
    region: def.region,
    proxy: def.proxyCountry ? makeProxy(def.proxyCountry) : undefined,
  }));
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
