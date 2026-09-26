/**
 * BrowserBot — Puppeteer headless checkout simulator
 *
 * Browser stack (owner locked):
 *   1. Browserless.io hosted Chrome via puppeteer.connect when BROWSERLESS_TOKEN set
 *   2. Bright Data geo rotating residential via geoProxy ProxyConfig (per testRegion)
 *   3. Local Chromium + stealth = fallback only when Browserless token unset
 *
 * Human-shopper verification path (HARD LAW: never complete paid purchase):
 *   1. bootstrapCart(merchant) — add a cheap/in-stock item
 *   2. navigateTowardCheckout — guest checkout when possible
 *   3. find promo field near payment step (BEFORE card details)
 *   4. applyCode → accept vs reject
 *   5. abandonCart — clear bag; NEVER type/submit card; NEVER place order
 *
 * ErrorMessage categories (prefix):
 *   cart_bootstrap_failed | no_promo_field | code_rejected | timeout | bot_blocked
 */

import vanillaPuppeteer from 'puppeteer';
import { addExtra } from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, ElementHandle, Page } from 'puppeteer';
import type { BrowserTestResult, ProxyConfig } from './types.js';

// puppeteer-extra + stealth under NodeNext ESM (tsc: use addExtra, not default import)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const puppeteer = addExtra(vanillaPuppeteer as any);
const stealth = StealthPlugin();
try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const evasions: Set<string> | undefined = (stealth as any).enabledEvasions;
  evasions?.delete('iframe.contentWindow');
  evasions?.delete('media.codecs');
} catch {
  /* ignore */
}
puppeteer.use(stealth);

/** Resolved Chromium proxy endpoint + optional page.authenticate credentials. */
interface EffectiveProxy {
  /** Chromium --proxy-server value, e.g. http://host:22225 */
  server: string;
  username?: string;
  password?: string;
  /** Fingerprint for singleton relaunch when US→UK / session rotates */
  key: string;
  source: 'env' | 'geo' | 'none';
}

/** Browserless API token — BROWSERLESS_TOKEN preferred; BROWSERLESS_API_TOKEN accepted. */
export function getBrowserlessToken(): string | undefined {
  const t =
    process.env.BROWSERLESS_TOKEN?.trim() ||
    process.env.BROWSERLESS_API_TOKEN?.trim();
  return t || undefined;
}

/** True when hosted Chrome via Browserless is configured (primary path). */
export function isBrowserlessConfigured(): boolean {
  return !!getBrowserlessToken();
}

/**
 * Default Browserless Chrome WS host (BaaS v2, documented 2026).
 * Override with BROWSERLESS_WS_ENDPOINT (base wss URL, no token).
 * @see https://docs.browserless.io/examples/puppeteer-connection
 */
const DEFAULT_BROWSERLESS_WS = 'wss://production-sfo.browserless.io';

/**
 * Build puppeteer.connect browserWSEndpoint.
 * Bright Data / geo: prefer externalProxyServer (credentials in URL).
 * Fallback: launch.args --proxy-server=host:port (page.authenticate still used).
 */
function buildBrowserlessWsEndpoint(effective: EffectiveProxy): string {
  const token = getBrowserlessToken();
  if (!token) {
    throw new Error('BROWSERLESS_TOKEN is not set');
  }

  const rawBase = (
    process.env.BROWSERLESS_WS_ENDPOINT?.trim() || DEFAULT_BROWSERLESS_WS
  ).replace(/\/$/, '');

  let baseUrl: URL;
  try {
    baseUrl = new URL(rawBase);
  } catch {
    throw new Error(
      `Invalid BROWSERLESS_WS_ENDPOINT: ${rawBase} (expected wss://host[/path])`
    );
  }

  baseUrl.searchParams.set('token', token);

  // Session length: Browserless closes the browser at its default timeout, which can
  // be shorter than bootstrap + checkout + N codes. Ask for the plan maximum
  // (free/starter = 120s; raise BROWSERLESS_SESSION_TIMEOUT_MS on bigger plans —
  // values above the plan limit are rejected with HTTP 400).
  if (!baseUrl.searchParams.has('timeout')) {
    const sessionMs = Number(process.env.BROWSERLESS_SESSION_TIMEOUT_MS || 120_000);
    if (Number.isFinite(sessionMs) && sessionMs > 0) {
      baseUrl.searchParams.set('timeout', String(Math.floor(sessionMs)));
    }
  }

  if (effective.source !== 'none' && effective.server) {
    if (effective.username && effective.password) {
      // Recommended Browserless third-party proxy param (HTTP(S) with auth).
      // Format: http://user:pass@host:port — URLSearchParams encodes the value once.
      // Do NOT pre-encode user/pass or searchParams will double-encode (% → %25).
      const hostPort = effective.server.replace(/^https?:\/\//i, '');
      const proxyWithAuth = `http://${effective.username}:${effective.password}@${hostPort}`;
      baseUrl.searchParams.set('externalProxyServer', proxyWithAuth);
      console.log(
        `[BrowserBot] Browserless + ${effective.source} proxy via externalProxyServer: ${effective.server}` +
          ` (auth user set, session/country in username)`
      );
    } else {
      // No credentials — Chrome --proxy-server via launch JSON
      const launch = {
        args: [`--proxy-server=${effective.server}`],
      };
      baseUrl.searchParams.set('launch', JSON.stringify(launch));
      console.log(
        `[BrowserBot] Browserless + ${effective.source} proxy via launch --proxy-server=${effective.server}`
      );
    }
  } else {
    const builtin = baseUrl.searchParams.get('proxy');
    console.log(
      builtin
        ? `[BrowserBot] Browserless connect via built-in ${builtin} proxy` +
            ` (country=${baseUrl.searchParams.get('proxyCountry') || 'any'})`
        : '[BrowserBot] Browserless connect (no geo/env proxy — datacenter exit IP)'
    );
  }

  return baseUrl.toString();
}

// Singleton browser — relaunched when effective proxy endpoint/credentials change
let browserInstance: Browser | null = null;
let activeProxyKey = 'none';
/** How the singleton was obtained — connect (remote) vs launch (local). */
let browserBackend: 'browserless' | 'local' | 'none' = 'none';

/** Parse PROXY_SERVER / RESIDENTIAL_PROXY_URL into Chromium server + optional auth. */
function parseProxyServerUrl(raw: string): {
  server: string;
  username?: string;
  password?: string;
} {
  try {
    const u = new URL(raw);
    const protocol = u.protocol || 'http:';
    const server = `${protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}`;
    return {
      server,
      username: u.username ? decodeURIComponent(u.username) : undefined,
      password: u.password ? decodeURIComponent(u.password) : undefined,
    };
  } catch {
    return { server: raw };
  }
}

/**
 * Env PROXY_SERVER / RESIDENTIAL_PROXY_URL is a global override.
 * Else geo ProxyConfig (Bright Data residential) supplies host:port + auth.
 */
function resolveEffectiveProxy(geoProxy?: ProxyConfig): EffectiveProxy {
  const envProxy = process.env.PROXY_SERVER || process.env.RESIDENTIAL_PROXY_URL;
  if (envProxy) {
    const parsed = parseProxyServerUrl(envProxy);
    return {
      server: parsed.server,
      username: parsed.username,
      password: parsed.password,
      key: `env|${parsed.server}|${parsed.username || ''}|${parsed.password ? '***' : ''}`,
      source: 'env',
    };
  }
  if (geoProxy?.host && geoProxy.port) {
    const server = `http://${geoProxy.host}:${geoProxy.port}`;
    return {
      server,
      username: geoProxy.username,
      password: geoProxy.password,
      key: `geo|${server}|${geoProxy.username || ''}|${geoProxy.password ? '***' : ''}`,
      source: 'geo',
    };
  }
  return { server: '', key: 'none', source: 'none' };
}

async function closeBrowserSingleton(): Promise<void> {
  if (browserInstance) {
    // Works for both puppeteer.launch and puppeteer.connect (Browserless)
    await browserInstance.close().catch(() => {});
    browserInstance = null;
  }
  activeProxyKey = 'none';
  browserBackend = 'none';
}

/**
 * Get a browser for a verify session.
 *
 * Priority:
 *   1. Browserless.io hosted Chrome via puppeteer.connect when BROWSERLESS_TOKEN set
 *      — Bright Data geo ProxyConfig attached via externalProxyServer (or --proxy-server)
 *   2. Local Chromium launch + stealth (PR #25 path) when Browserless unset
 *
 * When geo.proxy / env proxy changes (country or rotating session), close the
 * singleton so the new proxy key takes effect (same invariant as PR #25).
 */
async function getBrowser(geoProxy?: ProxyConfig): Promise<Browser> {
  const effective = resolveEffectiveProxy(geoProxy);
  const useBrowserless = isBrowserlessConfigured();
  const sessionKey = `${useBrowserless ? 'browserless' : 'local'}|${effective.key}`;

  if (browserInstance && browserInstance.connected && activeProxyKey === sessionKey) {
    return browserInstance;
  }

  if (browserInstance) {
    console.log(
      `[BrowserBot] Proxy/backend changed (${activeProxyKey} → ${sessionKey}) — ` +
        `${useBrowserless ? 'reconnecting Browserless' : 'relaunching Chromium'}`
    );
    await closeBrowserSingleton();
  }

  if (useBrowserless) {
    const browserWSEndpoint = buildBrowserlessWsEndpoint(effective);
    try {
      // puppeteer-extra connect — remote Chrome; stealth hooks still apply to pages
      browserInstance = await puppeteer.connect({ browserWSEndpoint });
      activeProxyKey = sessionKey;
      browserBackend = 'browserless';
      console.log('[BrowserBot] Connected to Browserless hosted Chrome');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to connect to Browserless (check BROWSERLESS_TOKEN / BROWSERLESS_WS_ENDPOINT` +
          ` and paid plan if using externalProxyServer): ${msg}`
      );
    }
    return browserInstance;
  }

  // ── Local Chromium fallback (PR #25 path) ───────────────────────────────
  // Prefer explicit env paths; otherwise let Puppeteer use its bundled Chrome.
  // NEVER default to a Windows Chrome path (breaks Linux/Render).
  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_PATH ||
    undefined;

  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--window-size=1366,768',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--lang=en-US,en',
  ];

  if (effective.source !== 'none' && effective.server) {
    launchArgs.push(`--proxy-server=${effective.server}`);
    console.log(
      `[BrowserBot] Using ${effective.source} proxy: ${effective.server}` +
        (effective.username ? ` (auth user set, session/country in username)` : '')
    );
  }

  try {
    browserInstance = await puppeteer.launch({
      ...(executablePath ? { executablePath } : {}),
      headless: process.env.USE_HEADLESS_BROWSER !== 'false',
      args: launchArgs,
      ignoreDefaultArgs: ['--enable-automation'],
    });
    activeProxyKey = sessionKey;
    browserBackend = 'local';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to launch Chrome/Puppeteer` +
        ` (set PUPPETEER_EXECUTABLE_PATH or CHROME_PATH if needed): ${msg}`
    );
  }
  return browserInstance;
}


async function wait(min: number, max?: number): Promise<void> {
  const ms = max ? Math.floor(Math.random() * (max - min + 1)) + min : min;
  return new Promise(resolve => setTimeout(resolve, ms));
}

type ErrorCategory =
  | 'cart_bootstrap_failed'
  | 'no_promo_field'
  | 'code_rejected'
  | 'timeout'
  | 'bot_blocked';

function categorized(category: ErrorCategory, detail: string): string {
  return `[${category}] ${detail}`;
}

function detectMerchant(merchantUrl: string): 'nike' | 'adidas' | 'generic' {
  try {
    const host = new URL(merchantUrl).hostname.toLowerCase();
    if (host.includes('nike.')) return 'nike';
    if (host.includes('adidas.')) return 'adidas';
  } catch {
    /* fall through */
  }
  return 'generic';
}

function originOf(merchantUrl: string): string {
  try {
    return new URL(merchantUrl).origin;
  } catch {
    return merchantUrl.replace(/\/$/, '');
  }
}

// ---------------------------------------------------------------------------
// Page setup helpers
// ---------------------------------------------------------------------------

async function preparePage(page: Page, proxy?: ProxyConfig): Promise<void> {
  // Stealth: keep UA, platform and client hints consistent with the REAL browser.
  // A hard-coded Chrome/131 Windows UA on a newer Linux Chrome is itself a bot
  // signal (UA vs sec-ch-ua vs navigator.platform mismatch), so derive it from
  // the connected browser and only strip the "Headless" marker.
  let realUa = '';
  try {
    realUa = (await page.browser().userAgent()).replace(/HeadlessChrome/g, 'Chrome');
  } catch {
    /* fall back below */
  }
  const ua =
    process.env.BROWSER_USER_AGENT ||
    (/Chrome\/\d+/.test(realUa)
      ? realUa
      : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  const uaPlatform = /Windows/i.test(ua) ? 'Win32' : /Mac OS X/i.test(ua) ? 'MacIntel' : 'Linux x86_64';

  await page.setUserAgent(ua);
  // Only Accept-Language — Chrome sets Accept/Encoding/sec-ch-ua itself and
  // hand-written client hints that disagree with the binary are detectable.
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
  });

  await page.setViewport({
    width: 1366,
    height: 768,
    deviceScaleFactor: 1,
    hasTouch: false,
    isLandscape: true,
  });

  const tz = process.env.BROWSER_TIMEZONE || 'America/New_York';
  try {
    await page.emulateTimezone(tz);
  } catch {
    /* optional */
  }

  // CDP / evaluate overrides — belt-and-suspenders with puppeteer-extra-plugin-stealth
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    // Only patch what is actually missing — overwriting a real PluginArray or
    // window.chrome with fakes is easier to fingerprint than leaving them alone.
    if (!navigator.plugins || navigator.plugins.length === 0) {
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(window as any).chrome) (window as any).chrome = { runtime: {} };
    const originalQuery = window.navigator.permissions?.query?.bind(
      window.navigator.permissions
    );
    if (originalQuery) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator.permissions as any).query = (parameters: any) =>
        parameters?.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
          : originalQuery(parameters);
    }
  });

  try {
    const client = await page.createCDPSession();
    await client.send('Network.setUserAgentOverride', {
      userAgent: ua,
      acceptLanguage: 'en-US,en;q=0.9',
      platform: uaPlatform,
    });
    await client.send('Emulation.setLocaleOverride', { locale: 'en-US' }).catch(() => {});
  } catch {
    /* CDP optional */
  }

  // Proxy auth matches Chromium --proxy-server from getBrowser(resolveEffectiveProxy)
  const effective = resolveEffectiveProxy(proxy);
  if (effective.username && effective.password) {
    await page.authenticate({
      username: effective.username,
      password: effective.password,
    });
  }
}

/** Human-like mouse wander — light anti-bot signal. */
async function humanMouseJitter(page: Page): Promise<void> {
  try {
    const vp = page.viewport() || { width: 1366, height: 768 };
    const x = Math.floor(80 + Math.random() * (vp.width - 160));
    const y = Math.floor(80 + Math.random() * (vp.height - 160));
    await page.mouse.move(x, y, { steps: 5 + Math.floor(Math.random() * 12) });
  } catch {
    /* ignore */
  }
}

/**
 * Warm-up: land on homepage / PLP briefly before cart bootstrap (human path).
 * Non-fatal — bootstrap still runs if warm-up fails.
 */
async function warmUpSession(
  page: Page,
  merchantUrl: string,
  navTimeout: number
): Promise<void> {
  const origin = originOf(merchantUrl);
  console.log('  → warm-up: homepage/PLP briefly (human path)');
  try {
    await page.goto(`${origin}/`, {
      waitUntil: 'domcontentloaded',
      timeout: navTimeout,
    });
    await wait(1400, 2800);
    await humanMouseJitter(page);
    await page.evaluate(() => {
      window.scrollBy(0, 180 + Math.floor(Math.random() * 420));
    });
    await wait(700, 1500);
  } catch (err) {
    console.warn(
      '  → warm-up skipped:',
      err instanceof Error ? err.message : String(err)
    );
  }
}


async function detectBotBlock(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const title = (document.title || '').toLowerCase();
    const body = (document.body?.innerText || '').toLowerCase().slice(0, 4000);
    const signals = [
      'access denied',
      'attention required',
      'cf-browser-verification',
      'checking your browser',
      'just a moment',
      'enable javascript and cookies',
      'bot detection',
      'unusual traffic',
      'verify you are human',
      'are you a robot',
      'perimeterx',
      'blocked',
    ];
    if (signals.some(s => title.includes(s) || body.includes(s))) {
      return document.title || 'Bot/challenge page detected';
    }
    // Cloudflare challenge iframe / turnstile markers
    if (
      document.querySelector('#challenge-form, .cf-challenge, iframe[src*="challenges.cloudflare"]')
    ) {
      return 'Cloudflare challenge detected';
    }
    return null;
  });
}

// ---------------------------------------------------------------------------
// Cart bootstrap — merchant-aware + generic fallback
// ---------------------------------------------------------------------------

async function clickFirstVisible(
  page: Page,
  selectors: string[]
): Promise<boolean> {
  for (const selector of selectors) {
    try {
      const els = await page.$$(selector);
      for (const el of els) {
        const visible = await el.isIntersectingViewport().catch(() => false);
        if (!visible) continue;
        await el.click();
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

async function clickByText(
  page: Page,
  phrases: string[],
  tagSelector = 'a, button, span, div[role="button"]'
): Promise<boolean> {
  return page.evaluate(
    (phrasesIn, tagSel) => {
      const clickables = Array.from(document.querySelectorAll(tagSel));
      for (const el of clickables) {
        const text = (el.textContent || '').toLowerCase().replace(/\s+/g, ' ').trim();
        if (
          text.length > 0 &&
          text.length < 80 &&
          phrasesIn.some(p => text.includes(p))
        ) {
          (el as HTMLElement).click();
          return true;
        }
      }
      return false;
    },
    phrases,
    tagSelector
  );
}

async function selectAvailableSize(page: Page): Promise<void> {
  // Nike / Adidas / generic size chips — skip disabled/out-of-stock
  const clicked = await page.evaluate(() => {
    const candidates = Array.from(
      document.querySelectorAll(
        [
          'button[data-testid*="size" i]',
          '[data-testid*="size" i] button',
          'button[aria-label*="Size" i]',
          'button[class*="size" i]',
          'label[class*="size" i]',
          'input[name*="size" i] + label',
          '[role="radio"]',
          'fieldset button',
        ].join(',')
      )
    );
    for (const el of candidates) {
      const html = el as HTMLElement;
      const disabled =
        html.hasAttribute('disabled') ||
        html.getAttribute('aria-disabled') === 'true' ||
        /out.?of.?stock|unavailable|disabled/i.test(
          (html.className || '') + ' ' + (html.getAttribute('aria-label') || '')
        );
      if (disabled) continue;
      const text = (html.textContent || '').trim();
      // Prefer short size labels (M, L, 8, 9.5, etc.)
      if (text.length > 0 && text.length <= 8) {
        html.click();
        return true;
      }
    }
    // Fallback: any non-disabled size-ish button
    for (const el of candidates) {
      const html = el as HTMLElement;
      if (html.hasAttribute('disabled')) continue;
      html.click();
      return true;
    }
    return false;
  });
  if (clicked) await wait(400, 800);
}

async function addToBag(page: Page): Promise<boolean> {
  await selectAvailableSize(page);

  const selectors = [
    'button[data-testid*="add-to-cart" i]',
    'button[data-testid*="add-to-bag" i]',
    'button[aria-label*="Add to Bag" i]',
    'button[aria-label*="Add to Cart" i]',
    'button[class*="add-to-cart" i]',
    'button[class*="add-to-bag" i]',
    '#add-to-cart',
    'button[name*="add" i]',
  ];
  if (await clickFirstVisible(page, selectors)) {
    await wait(1200, 2000);
    return true;
  }
  if (
    await clickByText(page, [
      'add to bag',
      'add to cart',
      'add to basket',
      'add to trolley',
    ])
  ) {
    await wait(1200, 2000);
    return true;
  }
  return false;
}

async function openFirstProductFromListing(page: Page): Promise<boolean> {
  const productSelectors = [
    'a[data-testid*="product" i]',
    'a[href*="/t/"]', // Nike PDP pattern
    'a[href*="/product/"]',
    'a[href*="/dp/"]',
    '[data-testid*="product-card" i] a',
    '.product-card a',
    'a[class*="product" i]',
  ];
  for (const selector of productSelectors) {
    try {
      const links = await page.$$(selector);
      for (const link of links.slice(0, 8)) {
        const href = await page.evaluate(el => (el as HTMLAnchorElement).href, link);
        if (!href || href.includes('#') || /cart|checkout|login|help/i.test(href)) {
          continue;
        }
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}),
          link.click(),
        ]);
        await wait(1000, 2000);
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Nike — real in-stock item → bag (size grid, modals, cart-API confirmation)
// ---------------------------------------------------------------------------

/** Watches the store's cart API so "Add to Bag" is confirmed (or a 403 block is named). */
interface CartApiWatch {
  writes: Array<{ at: number; status: number; method: string; kasada: boolean }>;
  /** Most recent write at/after `since` (ms epoch), if any. */
  lastWriteSince(since: number): { status: number; kasada: boolean } | undefined;
  dispose(): void;
}

const cartWatches = new WeakMap<Page, CartApiWatch>();

function watchCartApi(page: Page, urlPattern: RegExp): CartApiWatch {
  const existing = cartWatches.get(page);
  if (existing) return existing;
  const writes: CartApiWatch['writes'] = [];
  const onResponse = (res: import('puppeteer').HTTPResponse) => {
    try {
      const method = res.request().method();
      if (method === 'GET' || method === 'OPTIONS' || method === 'HEAD') return;
      if (!urlPattern.test(res.url())) return;
      const headers = res.headers();
      // Kasada (Nike's bot manager) stamps x-kpsdk-* on protected API responses
      const kasada = Object.keys(headers).some(h => h.startsWith('x-kpsdk'));
      writes.push({ at: Date.now(), status: res.status(), method, kasada });
      if (writes.length > 50) writes.shift();
    } catch {
      /* ignore */
    }
  };
  page.on('response', onResponse);
  const watch: CartApiWatch = {
    writes,
    lastWriteSince(since: number) {
      for (let i = writes.length - 1; i >= 0; i--) {
        if (writes[i].at >= since) return { status: writes[i].status, kasada: writes[i].kasada };
      }
      return undefined;
    },
    dispose() {
      page.off('response', onResponse);
      cartWatches.delete(page);
    },
  };
  cartWatches.set(page, watch);
  return watch;
}

const NIKE_CART_API = /api\.nike\.com\/buy\/carts\//i;

/** Human-ish click: scroll into view, move the mouse over it in steps, click. */
async function humanClick(page: Page, el: ElementHandle<Element>): Promise<void> {
  await el.evaluate(node => (node as HTMLElement).scrollIntoView({ block: 'center' })).catch(() => {});
  await wait(350, 800);
  const box = await el.boundingBox().catch(() => null);
  if (box && box.width > 0 && box.height > 0) {
    const x = box.x + box.width * (0.35 + Math.random() * 0.3);
    const y = box.y + box.height * (0.35 + Math.random() * 0.3);
    await page.mouse.move(x, y, { steps: 10 + Math.floor(Math.random() * 12) });
    await wait(120, 350);
    await page.mouse.click(x, y, { delay: 40 + Math.floor(Math.random() * 80) });
  } else {
    await el.click();
  }
}

/** Nike locale prefix from the merchant URL (nike.com/gb/... → /gb), else ''. */
function nikeBase(merchantUrl: string): string {
  const origin = originOf(merchantUrl);
  try {
    const m = new URL(merchantUrl).pathname.match(/^\/([a-z]{2})(\/|$)/i);
    if (m && !['t', 'w'].includes(m[1].toLowerCase())) return `${origin}/${m[1].toLowerCase()}`;
  } catch {
    /* ignore */
  }
  return origin;
}

/** Cookie banner, "choose your location" geo modal, promo pop-ups. Best-effort. */
async function dismissNikeModals(page: Page): Promise<void> {
  try {
    const clicked = await page.evaluate(() => {
      let n = 0;
      const buttons = Array.from(document.querySelectorAll('button, a[role="button"]')) as HTMLElement[];
      const accept = ['accept all', 'accept all cookies', 'accept cookies', 'allow all'];
      const stay = ['stay on', 'continue to nike', 'continue shopping here', 'no thanks', 'not now'];
      for (const b of buttons) {
        const t = (b.textContent || '').toLowerCase().replace(/\s+/g, ' ').trim();
        if (!t || t.length > 40) continue;
        if (accept.some(p => t === p || t.startsWith(p)) || stay.some(p => t.startsWith(p))) {
          b.click();
          n++;
        }
      }
      // Close (×) buttons inside open dialogs only — never page-level controls
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"]'));
      for (const d of dialogs) {
        const close = d.querySelector(
          'button[aria-label*="close" i], button[data-testid*="close" i], button[class*="close" i]'
        ) as HTMLElement | null;
        if (close) {
          close.click();
          n++;
        }
      }
      return n;
    });
    if (clicked) await wait(500, 1000);
  } catch {
    /* ignore */
  }
}

/** Header bag count ("Bag Items: N"), or null if the badge is not on the page. */
async function readNikeBagCount(page: Page): Promise<number | null> {
  try {
    return await page.evaluate(() => {
      const els = Array.from(
        document.querySelectorAll('[aria-label^="Bag Items" i], [data-testid*="cart-count" i], [data-testid="qa-cart-count"]')
      );
      let best: number | null = null;
      for (const el of els) {
        const src = `${el.getAttribute('aria-label') || ''} ${el.textContent || ''}`;
        const m = src.match(/(\d+)/);
        if (m) best = Math.max(best ?? 0, Number(m[1]));
      }
      return best;
    });
  } catch {
    return null;
  }
}

/**
 * Nike PDP size grid: input[name="grid-selector-input"] + <label for>.
 * Skips disabled / out-of-stock sizes; prefers mid sizes (M/L, 9–10).
 * Returns 'selected' | 'one-size' (no grid) | 'none-available'.
 */
async function selectNikeSize(page: Page): Promise<'selected' | 'one-size' | 'none-available'> {
  const pickId = await page.evaluate(() => {
    const inputs = Array.from(
      document.querySelectorAll('input[name="grid-selector-input"], [data-testid="pdp-grid-selector-item"] input')
    ) as HTMLInputElement[];
    if (inputs.length === 0) return '__one_size__';
    const available = inputs.filter(i => {
      if (i.disabled || i.getAttribute('aria-disabled') === 'true') return false;
      const label = i.id ? document.querySelector(`label[for="${CSS.escape(i.id)}"]`) : null;
      const cls = `${i.className} ${label?.className || ''} ${i.closest('[data-testid="pdp-grid-selector-item"]')?.className || ''}`;
      return !/disabled|unavailable|out-?of-?stock|sold-?out/i.test(cls);
    });
    if (available.length === 0) return '__none__';
    const preferred = ['M', 'L', '10', '9.5', '9', 'M 9 / W 10.5', 'S', 'XL'];
    const byPref = preferred
      .map(v => available.find(i => i.value.toUpperCase() === v.toUpperCase()))
      .find(Boolean);
    const pick = byPref || available[Math.floor(available.length / 2)];
    return pick.id || '__noid__';
  });
  if (pickId === '__one_size__') return 'one-size';
  if (pickId === '__none__' || pickId === '__noid__') return 'none-available';

  const label = await page.$(`label[for="${pickId.replace(/"/g, '\\"')}"]`);
  if (!label) return 'none-available';
  await humanClick(page, label);
  await wait(500, 1000);
  const checked = await page
    .evaluate(id => (document.getElementById(id) as HTMLInputElement | null)?.checked === true, pickId)
    .catch(() => false);
  return checked ? 'selected' : 'none-available';
}

/** Cheap, usually in-stock PLPs first (socks / accessories), then search + sale. */
function nikeListingUrls(base: string): string[] {
  return [
    `${base}/w/socks-7ny3q`,
    `${base}/w?q=socks&vst=socks`,
    `${base}/w/accessories-equipment-awwpw`,
    `${base}/w/sale-3yaep`,
  ];
}

/** Product URLs from a Nike PLP (product-card overlays; gift cards excluded). */
async function collectNikeProductUrls(page: Page, max: number): Promise<string[]> {
  try {
    return await page.evaluate(limit => {
      const out: string[] = [];
      const anchors = Array.from(
        document.querySelectorAll('a[data-testid="product-card__link-overlay"], a.product-card__link-overlay, a[href*="/t/"]')
      ) as HTMLAnchorElement[];
      for (const a of anchors) {
        const href = a.href;
        if (!href || !/\/t\//.test(href) || /gift-?card|GIFTCARD/i.test(href)) continue;
        if (!out.includes(href)) out.push(href);
        if (out.length >= limit) break;
      }
      return out;
    }, max);
  } catch {
    return [];
  }
}

async function bootstrapNike(page: Page, merchantUrl: string, navTimeout: number): Promise<void> {
  const base = nikeBase(merchantUrl);
  const watch = watchCartApi(page, NIKE_CART_API);

  // 1. Cheap in-stock listing (socks first) → candidate product URLs
  let productUrls: string[] = [];
  for (const url of nikeListingUrls(base)) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: navTimeout });
      await wait(1800, 3000);
      const blocked = await detectBotBlock(page);
      if (blocked) throw new Error(categorized('bot_blocked', blocked));
      await dismissNikeModals(page);
      await humanMouseJitter(page);
      await page.evaluate(() => window.scrollBy(0, 250 + Math.floor(Math.random() * 300))).catch(() => {});
      await wait(700, 1400);
      productUrls = await collectNikeProductUrls(page, 4);
      console.log(`  → Nike PLP ${new URL(url).pathname}: ${productUrls.length} product(s)`);
      if (productUrls.length) break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('[bot_blocked]')) throw err;
      continue;
    }
  }
  if (productUrls.length === 0) {
    throw new Error(categorized('cart_bootstrap_failed', 'Nike: no product found on socks/accessories/sale listings'));
  }

  // 2. Try up to 3 products: available size → Add to Bag → confirm bag count / cart API
  const reasons: string[] = [];
  for (const productUrl of productUrls.slice(0, 3)) {
    const slug = productUrl.split('/t/')[1]?.split('/')[0] || productUrl;
    try {
      await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: navTimeout });
      await wait(2500, 4000);
      const blocked = await detectBotBlock(page);
      if (blocked) throw new Error(categorized('bot_blocked', blocked));
      await dismissNikeModals(page);
      await humanMouseJitter(page);

      const before = (await readNikeBagCount(page)) ?? 0;
      const size = await selectNikeSize(page);
      console.log(`  → Nike PDP ${slug}: size ${size}`);
      if (size === 'none-available') {
        reasons.push(`${slug}: no in-stock size`);
        continue;
      }

      const atb =
        (await page.$('button[data-testid="atb-button"]')) ||
        (await page.$('button[aria-label="Add to Bag" i]')) ||
        (await page.$('button[data-testid*="add-to-cart" i]'));
      if (!atb) {
        reasons.push(`${slug}: no Add to Bag button`);
        continue;
      }
      const disabled = await atb.evaluate(b => (b as HTMLButtonElement).disabled).catch(() => false);
      if (disabled) {
        reasons.push(`${slug}: Add to Bag disabled`);
        continue;
      }

      const clickedAt = Date.now();
      await humanClick(page, atb);

      // Wait for the bag badge to increment or the cart API to answer
      let after = before;
      let write: { status: number; kasada: boolean } | undefined;
      for (let i = 0; i < 16; i++) {
        await wait(500);
        after = (await readNikeBagCount(page)) ?? after;
        write = watch.lastWriteSince(clickedAt);
        if (after > before) break;
        if (write && write.status >= 400 && i >= 4) break;
      }

      if (after > before) {
        console.log(`  → Nike: added ${slug} (size ${size}); bag count ${before} → ${after}`);
        await dismissNikeModals(page);
        return;
      }
      if (write && (write.status === 403 || write.status === 429)) {
        throw new Error(
          categorized(
            'bot_blocked',
            `Nike cart API rejected Add to Bag (HTTP ${write.status}` +
              `${write.kasada ? ', Kasada bot protection' : ''}) — store blocks automated carts from this browser/IP`
          )
        );
      }
      reasons.push(
        `${slug}: Add to Bag had no effect${write ? ` (cart API HTTP ${write.status})` : ' (no cart API call)'}`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('[bot_blocked]')) throw err;
      reasons.push(`${slug}: ${msg.slice(0, 120)}`);
    }
  }

  throw new Error(
    categorized('cart_bootstrap_failed', `Nike: could not add an in-stock item — ${reasons.join('; ')}`)
  );
}

async function bootstrapAdidas(page: Page, origin: string, navTimeout: number): Promise<void> {
  const startUrls = [
    `${origin}/us/sale`,
    `${origin}/us`,
    `${origin}/`,
  ];
  let loaded = false;
  for (const url of startUrls) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: navTimeout });
      await wait(1500, 2500);
      const blocked = await detectBotBlock(page);
      if (blocked) throw new Error(categorized('bot_blocked', blocked));
      loaded = true;
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('[bot_blocked]')) throw err;
      continue;
    }
  }
  if (!loaded) {
    throw new Error(categorized('cart_bootstrap_failed', 'Adidas PLP failed to load'));
  }

  await clickByText(page, ['accept all', 'accept cookies', 'agree', 'got it']).catch(() => {});
  await wait(400, 800);

  if (!(await openFirstProductFromListing(page))) {
    throw new Error(categorized('cart_bootstrap_failed', 'Adidas: no product link found'));
  }
  if (!(await addToBag(page))) {
    throw new Error(categorized('cart_bootstrap_failed', 'Adidas: Add to Bag failed'));
  }
}

async function bootstrapGeneric(page: Page, merchantUrl: string, navTimeout: number): Promise<void> {
  const origin = originOf(merchantUrl);
  const startUrls = [
    merchantUrl,
    `${origin}/collections/all`,
    `${origin}/shop`,
    `${origin}/sale`,
    `${origin}/`,
  ];

  let loaded = false;
  for (const url of startUrls) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: navTimeout });
      await wait(1200, 2200);
      const blocked = await detectBotBlock(page);
      if (blocked) throw new Error(categorized('bot_blocked', blocked));
      loaded = true;
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('[bot_blocked]')) throw err;
      continue;
    }
  }
  if (!loaded) {
    throw new Error(categorized('cart_bootstrap_failed', 'Store PLP/home failed to load'));
  }

  await clickByText(page, ['accept all', 'accept cookies', 'agree', 'got it']).catch(() => {});

  // If already on a PDP with add-to-cart, use it; else open a product
  const hasAdd = await page.$(
    'button[class*="add-to" i], button[data-testid*="add-to" i], #add-to-cart, button[name*="add" i]'
  );
  if (!hasAdd) {
    if (!(await openFirstProductFromListing(page))) {
      throw new Error(
        categorized('cart_bootstrap_failed', 'No product found to add to cart')
      );
    }
  }

  if (!(await addToBag(page))) {
    throw new Error(
      categorized('cart_bootstrap_failed', 'Add to cart/bag failed — item or size unavailable')
    );
  }
}

async function bootstrapCart(
  page: Page,
  merchantUrl: string,
  navTimeout: number
): Promise<void> {
  const merchant = detectMerchant(merchantUrl);
  const origin = originOf(merchantUrl);
  console.log(`  → bootstrapCart (${merchant}): ${origin}`);

  if (merchant === 'nike') {
    await bootstrapNike(page, merchantUrl, navTimeout);
  } else if (merchant === 'adidas') {
    await bootstrapAdidas(page, origin, navTimeout);
  } else {
    await bootstrapGeneric(page, merchantUrl, navTimeout);
  }
}

// ---------------------------------------------------------------------------
// Navigate toward checkout (stop BEFORE payment / card details)
// ---------------------------------------------------------------------------

async function preferGuestCheckout(page: Page): Promise<void> {
  const guestPhrases = [
    'guest checkout',
    'checkout as guest',
    'continue as guest',
    'guest',
    'continue without',
  ];
  if (await clickByText(page, guestPhrases)) {
    await wait(1000, 1800);
  }
}

/** HARD LAW: never interact with card/payment fields. */
async function isOnPaymentStep(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const cardHints = [
      'input[name*="card" i]',
      'input[autocomplete="cc-number"]',
      'input[name*="credit" i]',
      'iframe[name*="card" i]',
      'iframe[src*="stripe" i]',
      'iframe[src*="braintree" i]',
      '[data-testid*="card-number" i]',
    ];
    for (const sel of cardHints) {
      if (document.querySelector(sel)) return true;
    }
    const body = (document.body?.innerText || '').toLowerCase();
    // Promo near payment is OK; "place order" alone is not a stop signal yet
    return /card number|cvv|cvc|expir(y|ation)|payment details/.test(body);
  });
}

async function navigateTowardCheckout(
  page: Page,
  merchantUrl: string,
  navTimeout: number
): Promise<void> {
  const origin = originOf(merchantUrl);

  if (detectMerchant(merchantUrl) === 'nike') {
    // Nike's promo field ("Do you have a Promo Code?") is on the bag page, before
    // sign-in / guest checkout and long before any payment step — apply it there.
    await page.goto(`${nikeBase(merchantUrl)}/cart`, { waitUntil: 'domcontentloaded', timeout: navTimeout });
    await wait(2500, 4000);
    const nikeBlocked = await detectBotBlock(page);
    if (nikeBlocked) throw new Error(categorized('bot_blocked', nikeBlocked));
    await dismissNikeModals(page);
    const count = await readNikeBagCount(page);
    if (count === 0) {
      throw new Error(categorized('cart_bootstrap_failed', 'Nike: bag is empty on /cart after Add to Bag'));
    }
    await clickByText(page, ['do you have a promo code', 'promo code'], 'button, summary, div[role="button"]').catch(
      () => false
    );
    await wait(600, 1200);
    console.log(`  → Nike bag page (items: ${count ?? '?'}) — promo field is on this page`);
    return;
  }

  const bagUrls = [
    `${origin}/cart`,
    `${origin}/bag`,
    `${origin}/checkout/cart`,
    `${origin}/us/cart`,
    `${origin}/gb/cart`,
  ];

  // Try bag icon / "View bag" first
  await clickByText(page, ['view bag', 'view cart', 'go to bag', 'go to cart', 'bag (', 'cart (']).catch(
    () => {}
  );
  await wait(800, 1400);

  // If still not on cart, navigate directly
  const path = page.url().toLowerCase();
  if (!['/cart', '/bag', '/basket', '/checkout'].some(p => path.includes(p))) {
    for (const url of bagUrls) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: navTimeout });
        await wait(1000, 1800);
        break;
      } catch {
        continue;
      }
    }
  }

  const blocked = await detectBotBlock(page);
  if (blocked) {
    throw new Error(categorized('bot_blocked', blocked));
  }

  // Proceed toward checkout (guest when possible)
  const checkoutClicked =
    (await clickFirstVisible(page, [
      'a[href*="checkout" i]',
      'button[data-testid*="checkout" i]',
      'button[class*="checkout" i]',
      'a[class*="checkout" i]',
    ])) || (await clickByText(page, ['checkout', 'check out', 'proceed to checkout']));

  if (checkoutClicked) {
    await wait(1500, 2500);
    await preferGuestCheckout(page);
  }

  // HARD LAW: if we landed on payment with card fields, do NOT fill them.
  // Promo fields often appear on this step — that is intentional; we only apply promo.
  if (await isOnPaymentStep(page)) {
    console.log('  → At payment-adjacent step (promo only; will not submit card/order)');
  }
}

// ---------------------------------------------------------------------------
// Abandon cart — never place order
// ---------------------------------------------------------------------------

async function abandonCart(page: Page, merchantUrl: string): Promise<void> {
  console.log('  → abandonCart (never place order)');
  try {
    // Prefer remove/empty controls if present
    await clickByText(page, [
      'remove',
      'remove item',
      'delete',
      'empty bag',
      'empty cart',
      'clear cart',
    ]).catch(() => {});
    await wait(400, 800);

    // Navigate away from checkout to abandon
    const origin = originOf(merchantUrl);
    await page.goto(`${origin}/cart`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    await clickByText(page, ['remove', 'empty bag', 'empty cart', 'clear cart']).catch(() => {});
  } catch {
    /* best-effort abandon */
  }
}

// ---------------------------------------------------------------------------
// Find promo code input field
// ---------------------------------------------------------------------------

async function findPromoInput(page: Page): Promise<ElementHandle<Element> | null> {
  const selectors = [
    'input[name*="promo" i]',
    'input[name*="coupon" i]',
    'input[name*="discount" i]',
    'input[name*="voucher" i]',
    'input[name*="gift" i]',
    'input[name*="code" i]',
    'input[id*="promo" i]',
    'input[id*="coupon" i]',
    'input[id*="discount" i]',
    'input[id*="voucher" i]',
    'input[placeholder*="promo" i]',
    'input[placeholder*="coupon" i]',
    'input[placeholder*="discount" i]',
    'input[placeholder*="code" i]',
    'input[placeholder*="voucher" i]',
    'input[aria-label*="promo" i]',
    'input[aria-label*="coupon" i]',
    'input[aria-label*="discount" i]',
    'input[data-testid*="coupon" i]',
    'input[data-testid*="promo" i]',
  ];

  for (const selector of selectors) {
    try {
      const el = await page.$(selector);
      if (el) {
        const isVisible = await el.isIntersectingViewport().catch(() => true);
        if (isVisible) return el;
      }
    } catch {
      continue;
    }
  }

  const expandTriggers = [
    'a[class*="promo" i]',
    'button[class*="promo" i]',
    'a[class*="coupon" i]',
    'button[class*="coupon" i]',
    'span[class*="promo" i]',
    'summary',
    '[data-testid*="promo" i]',
    '[data-testid*="coupon" i]',
  ];

  for (const trigger of expandTriggers) {
    try {
      const el = await page.$(trigger);
      if (el) {
        await el.click();
        await wait(800, 1200);
        for (const selector of selectors) {
          const input = await page.$(selector).catch(() => null);
          if (input) return input;
        }
      }
    } catch {
      continue;
    }
  }

  try {
    const clicked = await page.evaluate(() => {
      const phrases = [
        'have a promo',
        'have a coupon',
        'promo code',
        'enter a promo',
        'enter promo',
        'add promo',
        'apply a code',
        'discount code',
        'got a code',
        'use a coupon',
        'enter code',
        'add a code',
      ];
      const clickables = Array.from(
        document.querySelectorAll('a, button, span, summary, div[role="button"]')
      );
      for (const el of clickables) {
        const text = (el.textContent || '').toLowerCase().replace(/\s+/g, ' ').trim();
        if (text.length > 0 && text.length < 80 && phrases.some(p => text.includes(p))) {
          (el as HTMLElement).click();
          return true;
        }
      }
      return false;
    });
    if (clicked) {
      await wait(800, 1200);
      for (const selector of selectors) {
        const input = await page.$(selector).catch(() => null);
        if (input) return input;
      }
    }
  } catch {
    /* ignore */
  }

  return null;
}

async function clickApplyButton(page: Page): Promise<boolean> {
  const selectors = [
    'button[type="submit"][class*="promo" i]',
    'button[type="submit"][class*="coupon" i]',
    'button[id*="apply" i]',
    'button[class*="apply" i]',
    'input[type="submit"][value*="apply" i]',
  ];

  for (const selector of selectors) {
    try {
      const el = await page.$(selector);
      if (el) {
        await el.click();
        return true;
      }
    } catch {
      continue;
    }
  }

  return page.evaluate(() => {
    const applyTexts = ['apply', 'submit', 'redeem', 'use code', 'go'];
    const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
    for (const btn of buttons) {
      const text = (
        btn.textContent ||
        (btn as HTMLInputElement).value ||
        ''
      )
        .toLowerCase()
        .trim();
      // Never click place-order / pay / buy
      if (/place order|pay now|buy now|complete purchase|submit order/.test(text)) {
        continue;
      }
      if (applyTexts.some(t => text.includes(t))) {
        (btn as HTMLElement).click();
        return true;
      }
    }
    return false;
  });
}

async function extractErrorSignal(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const errorSelectors = [
      '[class*="error" i]',
      '[class*="alert" i]',
      '[role="alert"]',
      '[aria-live="polite"]',
      '.message-error',
      '.notification-error',
      '.flash-error',
    ];

    const errorKeywords = [
      'invalid',
      'expired',
      'not valid',
      'cannot be applied',
      'does not apply',
      'not found',
      'incorrect',
      'not recognized',
      'already used',
      'maximum discount',
      'not applicable',
    ];

    for (const selector of errorSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const text = (el.textContent || '').toLowerCase().trim();
        if (text && errorKeywords.some(kw => text.includes(kw))) {
          return el.textContent?.trim().substring(0, 200) || null;
        }
      }
    }

    const bodyText = document.body.innerText.toLowerCase();
    for (const kw of errorKeywords) {
      if (bodyText.includes(kw)) {
        return `Code appears to be ${kw}`;
      }
    }

    return null;
  });
}

async function detectSuccessSignal(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const successKeywords = [
      'discount applied',
      'promo applied',
      'coupon applied',
      'code applied',
      'code accepted',
      'savings applied',
      'you saved',
      'discount:',
      'promotional discount',
      'voucher applied',
      'coupon code applied',
    ];
    const bodyText = document.body.innerText.toLowerCase();
    return successKeywords.some(kw => bodyText.includes(kw));
  });
}

async function extractPriceInfo(page: Page): Promise<{
  originalPrice?: string;
  finalPrice?: string;
  discountText?: string;
  discountAmount?: string;
  discountDetected?: boolean;
}> {
  try {
    return await page.evaluate(() => {
      const discountSelectors = [
        '[class*="discount" i]',
        '[class*="saving" i]',
        '[class*="promo" i]',
        '[class*="coupon" i]',
        '[id*="discount" i]',
        '[data-testid*="discount" i]',
        '.order-discount',
        '.cart-discount',
      ];

      let discountText = '';
      let discountAmount = '';

      for (const selector of discountSelectors) {
        const el = document.querySelector(selector);
        if (el?.textContent) {
          const text = el.textContent.trim();
          if (text) {
            discountText = text.substring(0, 100);
            const dollarMatch = text.match(/[-−]?\$[\d,]+\.?\d*/);
            const percentMatch = text.match(/\d+%/);
            if (dollarMatch) discountAmount = dollarMatch[0];
            else if (percentMatch) discountAmount = percentMatch[0] + ' off';
            break;
          }
        }
      }

      const strikethroughs = document.querySelectorAll(
        's, del, [class*="strike" i], [class*="original" i]'
      );
      let originalPrice = '';
      for (const el of strikethroughs) {
        const match = (el.textContent || '').match(/\$[\d,]+\.?\d*/);
        if (match) {
          originalPrice = match[0];
          break;
        }
      }

      const discountDetected = !!(discountText || discountAmount);
      return { originalPrice, discountText, discountAmount, discountDetected };
    });
  } catch {
    return {};
  }
}

async function applyCodeOnPage(
  page: Page,
  promoCode: string
): Promise<BrowserTestResult & { pageLoadTime: number }> {
  const start = Date.now();
  const promoInput = await findPromoInput(page);

  if (!promoInput) {
    return {
      success: false,
      errorMessage: categorized(
        'no_promo_field',
        'Promo field not found near checkout/payment step — cart may be empty or wrong stage'
      ),
      pageLoadTime: Date.now() - start,
    };
  }

  await promoInput.click({ clickCount: 3 });
  await wait(200, 400);

  // Clear existing value then type
  await promoInput.click({ clickCount: 3 });
  for (const char of promoCode) {
    await promoInput.type(char, { delay: Math.floor(Math.random() * 80) + 40 });
  }
  await wait(400, 800);

  const applyAt = Date.now();
  const applied = await clickApplyButton(page);
  if (applied) {
    await wait(2500, 4000);
  }

  // If the store's cart API refused the promo request itself (bot manager 403/429),
  // the code was never judged by the store — do not report it as rejected.
  const cartWrite = cartWatches.get(page)?.lastWriteSince(applyAt);
  if (cartWrite && (cartWrite.status === 403 || cartWrite.status === 429)) {
    return {
      success: false,
      errorMessage: categorized(
        'bot_blocked',
        `Store API refused the promo request (HTTP ${cartWrite.status}` +
          `${cartWrite.kasada ? ', Kasada bot protection' : ''}) — code not evaluated`
      ),
      pageLoadTime: Date.now() - start,
    };
  }

  const errorMessage = await extractErrorSignal(page);
  if (errorMessage) {
    return {
      success: false,
      errorMessage: categorized('code_rejected', errorMessage),
      pageLoadTime: Date.now() - start,
    };
  }

  const priceInfo = await extractPriceInfo(page);
  const successSignal = await detectSuccessSignal(page);

  if (priceInfo.discountDetected || successSignal) {
    return {
      success: true,
      ...priceInfo,
      discountText: priceInfo.discountText || 'Discount applied at checkout',
      discountAmount: priceInfo.discountAmount,
      pageLoadTime: Date.now() - start,
    };
  }

  return {
    success: false,
    errorMessage: categorized(
      'code_rejected',
      'Code submitted but no discount signal detected'
    ),
    pageLoadTime: Date.now() - start,
    ...priceInfo,
  };
}

async function clearPromoField(page: Page): Promise<void> {
  try {
    const input = await findPromoInput(page);
    if (!input) return;
    await input.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await wait(200, 400);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Main checkout simulation (single code — full human path)
// ---------------------------------------------------------------------------

export async function simulateCheckout(
  merchantUrl: string,
  promoCode: string,
  proxy?: ProxyConfig,
  timeoutMs: number = 60000
): Promise<BrowserTestResult> {
  const startTime = Date.now();
  let page: Page | null = null;
  const navTimeout = Math.min(timeoutMs, 45000);

  try {
    const browser = await getBrowser(proxy);
    page = await browser.newPage();
    await preparePage(page, proxy);

    await warmUpSession(page, merchantUrl, navTimeout);
      await bootstrapCart(page, merchantUrl, navTimeout);
    await navigateTowardCheckout(page, merchantUrl, navTimeout);

    const blocked = await detectBotBlock(page);
    if (blocked) {
      return {
        success: false,
        errorMessage: categorized('bot_blocked', blocked),
        pageLoadTime: Date.now() - startTime,
      };
    }

    await humanMouseJitter(page);
    await wait(400, 900);
    const result = await applyCodeOnPage(page, promoCode);
    await abandonCart(page, merchantUrl);

    return {
      ...result,
      pageLoadTime: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`  ✗ Checkout simulation error: ${errorMessage}`);

    // Preserve categorized errors thrown from helpers
    if (/^\[(cart_bootstrap_failed|no_promo_field|code_rejected|timeout|bot_blocked)\]/.test(errorMessage)) {
      return {
        success: false,
        errorMessage,
        pageLoadTime: Date.now() - startTime,
      };
    }

    const lower = errorMessage.toLowerCase();
    let categorizedMsg: string;
    if (lower.includes('timeout') || lower.includes('navigation')) {
      categorizedMsg = categorized(
        'timeout',
        'Page load timeout — store may be slow or blocking automation'
      );
    } else if (
      lower.includes('blocked') ||
      lower.includes('challenge') ||
      lower.includes('access denied')
    ) {
      categorizedMsg = categorized('bot_blocked', errorMessage);
    } else if (lower.includes('cart') || lower.includes('bag') || lower.includes('bootstrap')) {
      categorizedMsg = categorized('cart_bootstrap_failed', errorMessage);
    } else {
      categorizedMsg = errorMessage;
    }

    return {
      success: false,
      errorMessage: categorizedMsg,
      pageLoadTime: Date.now() - startTime,
    };
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
}

/**
 * Session-based batch: bootstrap cart once, apply each code at checkout-stage
 * promo field, clear between codes, abandon at end. Never completes purchase.
 */
export async function simulateCheckoutBatch(
  merchantUrl: string,
  promoCodes: string[],
  proxy?: ProxyConfig,
  timeoutMsPerCode: number = 60000
): Promise<BrowserTestResult[]> {
  const results: BrowserTestResult[] = [];
  let page: Page | null = null;
  const navTimeout = Math.min(timeoutMsPerCode, 45000);
  const sessionStart = Date.now();
  let botBlockSoftRetries = 0;

  try {
    const browser = await getBrowser(proxy);
    page = await browser.newPage();
    await preparePage(page, proxy);

    try {
      await warmUpSession(page, merchantUrl, navTimeout);
      await bootstrapCart(page, merchantUrl, navTimeout);
      await navigateTowardCheckout(page, merchantUrl, navTimeout);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const failAll = promoCodes.map(() => ({
        success: false,
        errorMessage: msg.startsWith('[')
          ? msg
          : categorized('cart_bootstrap_failed', msg),
        pageLoadTime: Date.now() - sessionStart,
      }));
      return failAll;
    }

    const blocked = await detectBotBlock(page);
    if (blocked) {
      return promoCodes.map(() => ({
        success: false,
        errorMessage: categorized('bot_blocked', blocked),
        pageLoadTime: Date.now() - sessionStart,
      }));
    }

    for (let i = 0; i < promoCodes.length; i++) {
      const codeStart = Date.now();
      try {
        await humanMouseJitter(page);
        await wait(400, 1100);
        let result = await applyCodeOnPage(page, promoCodes[i]);

        // Soft circuit: on bot_blocked, pause once with longer delay and retry same code
        if (
          result.errorMessage?.includes('bot_blocked') &&
          botBlockSoftRetries < 1
        ) {
          botBlockSoftRetries++;
          console.warn('  → bot_blocked mid-batch — soft pause + one retry');
          await wait(10_000, 18_000);
          await humanMouseJitter(page);
          result = await applyCodeOnPage(page, promoCodes[i]);
        }

        results.push({
          ...result,
          pageLoadTime: Date.now() - codeStart,
        });

        // Still blocked after soft retry → abort remaining (don't burn queue)
        if (
          result.errorMessage?.includes('bot_blocked') &&
          botBlockSoftRetries >= 1
        ) {
          console.warn('  → bot_blocked persists — aborting remaining codes');
          for (let j = i + 1; j < promoCodes.length; j++) {
            results.push({
              success: false,
              errorMessage: categorized(
                'bot_blocked',
                'Aborted — store bot-block after soft retry'
              ),
              pageLoadTime: 0,
            });
          }
          break;
        }

        await clearPromoField(page);
        if (i < promoCodes.length - 1) {
          await wait(800, 2000); // jittered gap between codes (human-like)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
          success: false,
          errorMessage: msg.includes('timeout')
            ? categorized('timeout', msg)
            : msg,
          pageLoadTime: Date.now() - codeStart,
        });
      }
    }

    await abandonCart(page, merchantUrl);
    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    while (results.length < promoCodes.length) {
      results.push({
        success: false,
        errorMessage: errorMessage.includes('timeout')
          ? categorized('timeout', errorMessage)
          : errorMessage,
        pageLoadTime: Date.now() - sessionStart,
      });
    }
    return results;
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
}

// ---------------------------------------------------------------------------
// Browser lifecycle
// ---------------------------------------------------------------------------

export async function cleanup(): Promise<void> {
  if (browserInstance) {
    const was = browserBackend;
    await closeBrowserSingleton();
    console.log(
      `[BrowserBot] Browser instance closed` +
        (was === 'browserless' ? ' (Browserless disconnect).' : '.')
    );
  }
}

export { getBrowser };