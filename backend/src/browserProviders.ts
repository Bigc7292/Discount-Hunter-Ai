/**
 * BrowserProviders — hosted-browser provider chain for the checkout verifier.
 *
 * Order comes from BROWSER_PROVIDER_ORDER (default `kernel,cloudflare,browserless,local`).
 * A provider whose env vars are missing is skipped. On a connect failure, 401, 402,
 * 429 or quota error the verifier falls through to the next provider and logs why
 * (see browserRoute.ts / verifier.ts).
 *
 *   kernel      — Kernel cloud browser (KERNEL_API_KEY). REST: POST /browsers with
 *                 stealth=true + headless, connect to cdp_ws_url, ALWAYS
 *                 DELETE /browsers/{id} afterwards (browser.close() does not end it).
 *                 @see https://www.kernel.sh/docs/browsers/create-a-browser
 *   cloudflare  — Cloudflare Browser Run CDP (CF_ACCOUNT_ID + CF_API_TOKEN).
 *                 @see https://developers.cloudflare.com/browser-run/cdp/puppeteer/
 *   browserless — existing Browserless path (BROWSERLESS_TOKEN), unchanged.
 *   local       — existing local Chromium launch, unchanged.
 *
 * Never logs API keys, tokens or signed CDP URLs.
 */

import https from 'https';
import { randomBytes } from 'crypto';

export type BrowserProvider = 'kernel' | 'cloudflare' | 'browserless' | 'local';

export const DEFAULT_BROWSER_PROVIDER_ORDER: BrowserProvider[] = ['kernel', 'cloudflare', 'browserless', 'local'];

export const PROVIDER_LABELS: Record<BrowserProvider, string> = {
  kernel: 'Kernel',
  cloudflare: 'Cloudflare Browser Run',
  browserless: 'Browserless',
  local: 'local Chromium',
};

const KERNEL_API_BASE = 'https://api.onkernel.com';
/** Kernel inactivity timeout (seconds) — generous so 3–5 code batches fit. Min 10. */
const KERNEL_DEFAULT_TIMEOUT_SECONDS = 300;
/** Cloudflare keep_alive (ms) — Browser Run maximum is 10 minutes. */
const CF_DEFAULT_KEEP_ALIVE_MS = 600_000;
const CF_MAX_KEEP_ALIVE_MS = 600_000;

// ── Configuration ──────────────────────────────────────────────────────────

export function getKernelApiKey(): string | undefined {
  return process.env.KERNEL_API_KEY?.trim() || undefined;
}

export function isKernelConfigured(): boolean {
  return !!getKernelApiKey();
}

function getCloudflareCreds(): { accountId: string; apiToken: string } | undefined {
  const accountId = process.env.CF_ACCOUNT_ID?.trim();
  const apiToken = process.env.CF_API_TOKEN?.trim();
  return accountId && apiToken ? { accountId, apiToken } : undefined;
}

export function isCloudflareBrowserConfigured(): boolean {
  return !!getCloudflareCreds();
}

function isBrowserlessEnvSet(): boolean {
  return !!(process.env.BROWSERLESS_TOKEN?.trim() || process.env.BROWSERLESS_API_TOKEN?.trim());
}

export function isProviderConfigured(p: BrowserProvider): boolean {
  switch (p) {
    case 'kernel':
      return isKernelConfigured();
    case 'cloudflare':
      return isCloudflareBrowserConfigured();
    case 'browserless':
      return isBrowserlessEnvSet();
    case 'local':
      return true;
  }
}

/** Parsed BROWSER_PROVIDER_ORDER (unknown names ignored, duplicates dropped). */
export function getProviderOrder(): BrowserProvider[] {
  const raw = process.env.BROWSER_PROVIDER_ORDER?.trim();
  if (!raw) return [...DEFAULT_BROWSER_PROVIDER_ORDER];
  const out: BrowserProvider[] = [];
  for (const part of raw.split(',')) {
    const name = part.trim().toLowerCase();
    if ((DEFAULT_BROWSER_PROVIDER_ORDER as string[]).includes(name) && !out.includes(name as BrowserProvider)) {
      out.push(name as BrowserProvider);
    }
  }
  if (out.length === 0) {
    console.warn(`[BrowserProviders] BROWSER_PROVIDER_ORDER has no known providers — using default order`);
    return [...DEFAULT_BROWSER_PROVIDER_ORDER];
  }
  return out;
}

/** Providers in order whose env vars are present (local is always "configured"). */
export function getConfiguredProviders(): BrowserProvider[] {
  return getProviderOrder().filter(isProviderConfigured);
}

/** First configured provider — used when no verify route was applied (single-code API). */
export function defaultProvider(): BrowserProvider {
  return getConfiguredProviders()[0] || 'local';
}

// ── Cooldown (402 / 429 / quota / bad key) ────────────────────────────────

const cooldowns = new Map<BrowserProvider, { until: number; since: number; reason: string }>();

export function markProviderCooldown(p: BrowserProvider, ms: number, reason: string): void {
  if (p === 'local' || !(ms > 0)) return;
  cooldowns.set(p, { until: Date.now() + ms, since: Date.now(), reason });
  console.warn(
    `[BrowserProviders] ${PROVIDER_LABELS[p]} cooling down for ${Math.round(ms / 1000)}s: ${reason}`
  );
}

export function providerCooldown(
  p: BrowserProvider
): { remainingMs: number; since: number; reason: string } | null {
  const c = cooldowns.get(p);
  if (!c) return null;
  const remainingMs = c.until - Date.now();
  if (remainingMs <= 0) {
    cooldowns.delete(p);
    return null;
  }
  return { remainingMs, since: c.since, reason: c.reason };
}

/** True for refusals that mean "don't use this provider right now" (bad key, payment, quota, rate limit). */
export function isQuotaOrAuthRefusal(status: number, message: string): boolean {
  if (status === 401 || status === 402 || status === 403 || status === 429) return true;
  return /quota|rate.?limit|too many requests|limit (?:exceeded|reached)|insufficient (?:credits|balance)|payment required|usage limit|out of (?:credits|units)/i.test(
    message || ''
  );
}

/** How long to skip a provider after a refusal. 429 honours Retry-After when present. */
export function cooldownMsFor(status: number, message: string, retryAfterSec?: number): number {
  if (status === 429) {
    return retryAfterSec && retryAfterSec > 0 ? Math.min(retryAfterSec, 3600) * 1000 : 60_000;
  }
  if (status === 401 || status === 402 || status === 403) return 30 * 60_000;
  if (isQuotaOrAuthRefusal(status, message)) return 30 * 60_000;
  return 0;
}

/** Parse Retry-After (delta-seconds or HTTP date) → seconds. */
export function parseRetryAfter(v: string | string[] | undefined | null): number | undefined {
  const raw = Array.isArray(v) ? v[0] : v;
  if (!raw) return undefined;
  const n = Number(raw);
  if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  const t = Date.parse(raw);
  return Number.isFinite(t) ? Math.max(0, Math.round((t - Date.now()) / 1000)) : undefined;
}

// ── Errors ─────────────────────────────────────────────────────────────────

/**
 * Hosted-provider start failure. Message always starts with
 * "Failed to connect to <Provider>" so verifier.classifyStage → browser_connect
 * (never counted as tested).
 */
export class ProviderConnectError extends Error {
  constructor(
    public provider: BrowserProvider,
    public status: number,
    detail: string,
    public retryAfterSec?: number
  ) {
    super(
      `Failed to connect to ${PROVIDER_LABELS[provider]}` +
        (status ? ` (HTTP ${status})` : '') +
        `: ${detail}` +
        (retryAfterSec ? ` (Retry-After ${retryAfterSec}s)` : '')
    );
    this.name = 'ProviderConnectError';
  }
}

function scrub(s: string, ...secrets: (string | undefined)[]): string {
  let out = s;
  for (const secret of secrets) {
    if (secret) out = out.split(secret).join('***');
  }
  // Signed CDP URLs carry JWTs / tokens in the query string
  return out.replace(/(wss?:\/\/[^\s?"']+)\?[^\s"']*/gi, '$1?***');
}

// ── Kernel (REST) ──────────────────────────────────────────────────────────

export interface KernelSession {
  sessionId: string;
  cdpWsUrl: string;
  timeoutSeconds: number;
}

function kernelTimeoutSeconds(): number {
  const n = Number(process.env.KERNEL_TIMEOUT_SECONDS || KERNEL_DEFAULT_TIMEOUT_SECONDS);
  return Number.isFinite(n) ? Math.min(259_200, Math.max(10, Math.floor(n))) : KERNEL_DEFAULT_TIMEOUT_SECONDS;
}

async function kernelFetch(method: string, pathname: string, body?: unknown): Promise<Response> {
  const apiKey = getKernelApiKey();
  if (!apiKey) throw new ProviderConnectError('kernel', 0, 'KERNEL_API_KEY is not set');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    return await fetch(`${KERNEL_API_BASE}${pathname}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Create a Kernel browser (stealth, headless unless KERNEL_HEADLESS=false). */
export async function createKernelBrowser(): Promise<KernelSession> {
  const apiKey = getKernelApiKey();
  const timeoutSeconds = kernelTimeoutSeconds();
  const headless = process.env.KERNEL_HEADLESS?.trim().toLowerCase() !== 'false';
  let res: Response;
  try {
    res = await kernelFetch('POST', '/browsers', { stealth: true, headless, timeout_seconds: timeoutSeconds });
  } catch (err) {
    if (err instanceof ProviderConnectError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new ProviderConnectError('kernel', 0, `create request failed (${scrub(msg, apiKey).slice(0, 160)})`);
  }
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    throw new ProviderConnectError(
      'kernel',
      res.status,
      scrub(text.trim(), apiKey).slice(0, 200) || res.statusText || 'browser create refused',
      parseRetryAfter(res.headers.get('retry-after'))
    );
  }
  let json: { session_id?: string; cdp_ws_url?: string; timeout_seconds?: number };
  try {
    json = JSON.parse(text);
  } catch {
    throw new ProviderConnectError('kernel', res.status, 'browser create returned non-JSON');
  }
  if (!json.session_id || !json.cdp_ws_url) {
    // Created something we can't drive — try to delete it if we have an id
    if (json.session_id) await deleteKernelBrowser(json.session_id);
    throw new ProviderConnectError('kernel', res.status, 'browser create response missing session_id/cdp_ws_url');
  }
  console.log(
    `[BrowserProviders] Kernel browser created (stealth, headless=${headless}, timeout_seconds=${json.timeout_seconds ?? timeoutSeconds})`
  );
  return { sessionId: json.session_id, cdpWsUrl: json.cdp_ws_url, timeoutSeconds: json.timeout_seconds ?? timeoutSeconds };
}

/** Delete a Kernel browser by id. Never throws (404 = already gone). */
export async function deleteKernelBrowser(sessionId: string): Promise<void> {
  try {
    const res = await kernelFetch('DELETE', `/browsers/${encodeURIComponent(sessionId)}`);
    if (!res.ok && res.status !== 404) {
      console.warn(`[BrowserProviders] Kernel browser delete returned HTTP ${res.status}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[BrowserProviders] Kernel browser delete failed: ${scrub(msg, getKernelApiKey()).slice(0, 160)}`);
  }
}

// ── Cloudflare Browser Run (CDP) ───────────────────────────────────────────

function cfKeepAliveMs(): number {
  const n = Number(process.env.CF_BROWSER_KEEP_ALIVE_MS || CF_DEFAULT_KEEP_ALIVE_MS);
  return Number.isFinite(n) && n > 0 ? Math.min(CF_MAX_KEEP_ALIVE_MS, Math.floor(n)) : CF_DEFAULT_KEEP_ALIVE_MS;
}

/** puppeteer.connect options for Cloudflare Browser Run (token in header, never in URL). */
export function cloudflareConnectOptions(): { browserWSEndpoint: string; headers: Record<string, string> } {
  const creds = getCloudflareCreds();
  if (!creds) throw new ProviderConnectError('cloudflare', 0, 'CF_ACCOUNT_ID / CF_API_TOKEN not set');
  const keepAlive = cfKeepAliveMs();
  return {
    browserWSEndpoint:
      `wss://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(creds.accountId)}` +
      `/browser-rendering/devtools/browser?keep_alive=${keepAlive}`,
    headers: { Authorization: `Bearer ${creds.apiToken}` },
  };
}

/** Scrub the Cloudflare token out of an error message. */
export function scrubCloudflare(msg: string): string {
  return scrub(msg, getCloudflareCreds()?.apiToken);
}

/**
 * Probe the Cloudflare WS handshake to learn the real refusal (status + Retry-After):
 * puppeteer only surfaces "Unexpected server response" / "[object Object]".
 * Only called after a failed connect; a 101 is closed immediately.
 */
export async function probeCloudflareHandshake(): Promise<{ status: number; message: string; retryAfterSec?: number }> {
  const creds = getCloudflareCreds();
  if (!creds) return { status: 0, message: 'CF_ACCOUNT_ID / CF_API_TOKEN not set' };
  const url = new URL(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(creds.accountId)}` +
      `/browser-rendering/devtools/browser?keep_alive=10000`
  );
  return new Promise(resolve => {
    const req = https.request(url, {
      method: 'GET',
      timeout: 8000,
      headers: {
        Authorization: `Bearer ${creds.apiToken}`,
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
        resolve({
          status: res.statusCode || 0,
          message: scrub(body.trim(), creds.apiToken).slice(0, 200),
          retryAfterSec: parseRetryAfter(res.headers['retry-after']),
        })
      );
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, message: 'handshake timeout' });
    });
    req.on('error', err => resolve({ status: 0, message: scrub(err.message, creds.apiToken).slice(0, 200) }));
    req.end();
  });
}
