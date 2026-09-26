/**
 * BrowserRoute — pick a working hosted-browser route for a verify batch.
 *
 * Why: Browserless `externalProxyServer` (Bright Data) is rejected with
 * HTTP 401 "Only paid cloud-unit plans can utilize a third-party proxy" on
 * non-paid Browserless plans, so every code failed at connect and was still
 * counted as "tested". This module lets the verifier fall back automatically:
 *
 *   1. Browserless + Bright Data via externalProxyServer (paid Browserless plan)
 *   2. Browserless built-in residential proxy (proxy=residential&proxyCountry=cc)
 *   3. Browserless direct (datacenter exit IP)
 *   (local Chromium + geo proxy only when BROWSERLESS_TOKEN is unset)
 *
 * Optional BROWSERLESS_PROXY_MODE: auto (default) | external | builtin | none
 *
 * browserBot.ts builds the WS URL from BROWSERLESS_WS_ENDPOINT (query params are
 * preserved) + the ProxyConfig passed in, so a route = (WS base query, proxy arg).
 * Never logs tokens or proxy passwords.
 */

import https from 'https';
import { randomBytes } from 'crypto';
import type { ProxyConfig } from './types.js';
import { cleanup, getBrowserlessToken, isBrowserlessConfigured } from './browserBot.js';

const DEFAULT_BROWSERLESS_WS = 'wss://production-sfo.browserless.io';
/** Skip the external-proxy route for a while after Browserless refuses it (no-cost 401, but noisy). */
const EXTERNAL_REJECT_TTL_MS = 30 * 60_000;

export type VerifyRouteKind =
  | 'browserless-external-proxy'
  | 'browserless-builtin-residential'
  | 'browserless-direct'
  | 'local';

export interface VerifyRoute {
  kind: VerifyRouteKind;
  /** Human label for logs / API (no secrets) */
  label: string;
  /** ProxyConfig handed to simulateCheckoutBatch (undefined = no third-party proxy) */
  proxy?: ProxyConfig;
  /** Extra Browserless WS query params (built-in proxy) */
  wsQuery?: Record<string, string>;
}

let externalRejected: { at: number; reason: string } | null = null;

function proxyMode(): 'auto' | 'external' | 'builtin' | 'none' {
  const m = (process.env.BROWSERLESS_PROXY_MODE || 'auto').trim().toLowerCase();
  return m === 'external' || m === 'builtin' || m === 'none' ? m : 'auto';
}

/**
 * Ordered list of routes to try for this batch.
 * @param proxyCountry ISO-2 lowercase (us, gb, …) or undefined for GLOBAL
 */
export function planVerifyRoutes(
  geoProxy: ProxyConfig | undefined,
  proxyCountry: string | undefined
): VerifyRoute[] {
  if (!isBrowserlessConfigured()) {
    return [{ kind: 'local', label: 'local Chromium' + (geoProxy ? ' + geo proxy' : ''), proxy: geoProxy }];
  }

  const mode = proxyMode();
  const routes: VerifyRoute[] = [];
  const hasGeoAuth = !!(geoProxy?.username && geoProxy?.password);

  if (hasGeoAuth && (mode === 'auto' || mode === 'external')) {
    if (externalRejected && Date.now() - externalRejected.at < EXTERNAL_REJECT_TTL_MS && mode === 'auto') {
      console.warn(
        `[BrowserRoute] Skipping Browserless externalProxyServer (rejected ` +
          `${Math.round((Date.now() - externalRejected.at) / 60_000)}m ago: ${externalRejected.reason})`
      );
    } else {
      routes.push({
        kind: 'browserless-external-proxy',
        label: 'Browserless + Bright Data (externalProxyServer)',
        proxy: geoProxy,
      });
    }
  }

  if (proxyCountry && (mode === 'auto' || mode === 'builtin')) {
    routes.push({
      kind: 'browserless-builtin-residential',
      label: `Browserless built-in residential proxy (${proxyCountry})`,
      wsQuery: { proxy: 'residential', proxyCountry },
    });
  }

  if (mode === 'auto' || mode === 'none' || routes.length === 0) {
    routes.push({ kind: 'browserless-direct', label: 'Browserless direct (datacenter IP)' });
  }

  return routes;
}

/**
 * Point browserBot at a route: sets BROWSERLESS_WS_ENDPOINT query params and
 * drops the singleton so the next getBrowser() reconnects with them.
 * Returns the ProxyConfig to pass to simulateCheckoutBatch.
 */
export async function applyVerifyRoute(
  route: VerifyRoute,
  originalWsEndpoint: string | undefined
): Promise<ProxyConfig | undefined> {
  if (route.kind !== 'local') {
    const base = new URL((originalWsEndpoint?.trim() || DEFAULT_BROWSERLESS_WS).replace(/\/$/, ''));
    for (const [k, v] of Object.entries(route.wsQuery || {})) {
      base.searchParams.set(k, v);
    }
    process.env.BROWSERLESS_WS_ENDPOINT = base.toString();
  }
  await cleanup();
  console.log(`[BrowserRoute] Verify route: ${route.label}`);
  return route.proxy;
}

/** Restore env after the batch (so /health + next batch start clean). */
export function restoreWsEndpoint(originalWsEndpoint: string | undefined): void {
  if (originalWsEndpoint === undefined) {
    delete process.env.BROWSERLESS_WS_ENDPOINT;
  } else {
    process.env.BROWSERLESS_WS_ENDPOINT = originalWsEndpoint;
  }
}

/** True when the browser never started (connect/launch failure) — nothing reached the store. */
export function isBrowserStartFailure(errorMessage?: string): boolean {
  const m = (errorMessage || '').toLowerCase();
  return (
    m.includes('failed to connect to browserless') ||
    m.includes('failed to launch chrome') ||
    m.includes('browserless_token is not set') ||
    m.includes('invalid browserless_ws_endpoint')
  );
}

/**
 * Probe the Browserless WS handshake (HTTP upgrade) to capture the real refusal
 * reason — puppeteer surfaces it as "[object Object]". A 401 costs no browser time.
 */
export async function probeBrowserlessHandshake(
  route: VerifyRoute,
  originalWsEndpoint: string | undefined
): Promise<{ status: number; message: string }> {
  const token = getBrowserlessToken();
  if (!token) return { status: 0, message: 'BROWSERLESS_TOKEN not set' };

  const url = new URL((originalWsEndpoint?.trim() || DEFAULT_BROWSERLESS_WS).replace(/\/$/, ''));
  url.protocol = url.protocol === 'ws:' ? 'http:' : 'https:';
  url.searchParams.set('token', token);
  for (const [k, v] of Object.entries(route.wsQuery || {})) url.searchParams.set(k, v);
  if (route.kind === 'browserless-external-proxy' && route.proxy?.username && route.proxy.password) {
    url.searchParams.set(
      'externalProxyServer',
      `http://${route.proxy.username}:${route.proxy.password}@${route.proxy.host}:${route.proxy.port}`
    );
  }

  const scrub = (s: string) =>
    s.split(token).join('***').split(route.proxy?.password || '\u0000').join('***');

  return new Promise(resolve => {
    const req = https.request(url, {
      method: 'GET',
      timeout: 8000,
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': randomBytes(16).toString('base64'),
      },
    });
    req.on('upgrade', (_res, socket) => {
      socket.destroy();
      resolve({ status: 101, message: 'handshake accepted' });
    });
    req.on('response', res => {
      let body = '';
      res.on('data', chunk => {
        if (body.length < 400) body += String(chunk);
      });
      res.on('end', () =>
        resolve({ status: res.statusCode || 0, message: scrub(body.trim()).slice(0, 200) })
      );
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, message: 'handshake timeout' });
    });
    req.on('error', err => resolve({ status: 0, message: scrub(err.message).slice(0, 200) }));
    req.end();
  });
}

/** Remember that Browserless refused the third-party proxy (plan limit) so later hunts skip it. */
export function markExternalProxyRejected(reason: string): void {
  externalRejected = { at: Date.now(), reason };
}
