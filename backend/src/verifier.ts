/**
 * Verifier — Orchestrates real checkout testing for each candidate code
 *
 * Improvements:
 * - Strict confidence gate: browserTestPassed MUST be true for 'verified' status
 * - discountText and discountAmount passed through to response
 * - Session cart bootstrap → checkout-stage promo apply → abandon (via browserBot)
 * - Per-code ~60s; batch timeout raised for multi-step checkout flows
 * - Better confidence scoring with real factors
 * - Categorized errorMessages: cart_bootstrap_failed | no_promo_field | code_rejected | timeout | bot_blocked
 * - HONEST COUNTS: `totalTested` = codes actually applied at the promo field.
 *   Codes that never got there (browser connect, proxy auth, bot block, empty cart,
 *   timeout) are `couldNotTest` with a stage + reason — never counted as "tested"
 *   and never reported as "rejected at checkout".
 * - Browser route fallback (browserRoute.ts): provider chain from
 *   BROWSER_PROVIDER_ORDER (default kernel → cloudflare → browserless → local);
 *   Browserless itself tries externalProxyServer → built-in residential → direct.
 *   Falls through when a route fails before reaching the store (connect failure,
 *   HTTP 401/402/429, quota) and logs why; refusing providers cool down
 *   (429 honours Retry-After). Provider + browser seconds are logged per run.
 */

import type {
  CandidateCode,
  MerchantInfo,
  VerificationRequest,
  VerificationResponse,
  CodeVerificationResult,
  ProxyConfig,
  VerifyStage,
} from './types.js';
import { getGeoLocation } from './geoProxy.js';
import { releaseHostedBrowser, simulateCheckout, simulateCheckoutBatch } from './browserBot.js';
import { appendLedgerFromResult } from './ledger.js';
import {
  applyVerifyRoute,
  isBrowserStartFailure,
  markExternalProxyRejected,
  planVerifyRoutes,
  probeBrowserlessHandshake,
  restoreWsEndpoint,
  type VerifyRoute,
} from './browserRoute.js';
import {
  PROVIDER_LABELS,
  cooldownMsFor,
  isQuotaOrAuthRefusal,
  markProviderCooldown,
  probeCloudflareHandshake,
  providerCooldown,
} from './browserProviders.js';

// Per-code budget inside a cart session (apply + read) — ~45–60s
const PER_CODE_TIMEOUT_MS = 55_000;

// Batch budget scales with N; hard ceiling ~20 min (Render free may kill sooner — see AGENTS.md)
const BATCH_BOOTSTRAP_BUFFER_MS = 90_000;
const BATCH_TIMEOUT_MAX_MS = 1_200_000; // 20 minutes

/** Overall batch deadline: bootstrap buffer + N × per-code, capped. */
export function batchTimeoutFor(codeCount: number): number {
  const n = Math.max(1, codeCount);
  return Math.min(BATCH_TIMEOUT_MAX_MS, BATCH_BOOTSTRAP_BUFFER_MS + n * PER_CODE_TIMEOUT_MS);
}

// ---------------------------------------------------------------------------
// Stage classification — did the code actually reach the promo field?
// ---------------------------------------------------------------------------

/** Short UI/log-safe labels (no code strings). */
export const STAGE_LABELS: Record<VerifyStage, string> = {
  applied: 'applied at promo field',
  browser_connect: 'checkout browser could not start (hosted browser connect failed)',
  proxy_auth: 'residential proxy rejected the connection (auth/tunnel)',
  bot_blocked: 'store blocked automation',
  cart_bootstrap: 'could not add an item to the cart',
  no_promo_field: 'promo field not reached (empty cart / no promo field)',
  timeout: 'page load timeout',
  navigation: 'store page failed to load',
  skipped: 'skipped after an earlier checkout failure',
  unknown: 'checkout step failed before the code was entered',
};

function isProxyFailure(m: string): boolean {
  return (
    /\b407\b/.test(m) ||
    m.includes('proxy auth') ||
    m.includes('err_tunnel_connection_failed') ||
    m.includes('err_proxy_connection_failed') ||
    m.includes('err_proxy_auth') ||
    m.includes('err_no_supported_proxies') ||
    m.includes('err_proxy_certificate_invalid')
  );
}

/**
 * Where did this attempt end? 'applied' ONLY when the browser test passed or the
 * store answered the applied code (categorized [code_rejected] / expired / invalid).
 */
export function classifyStage(success: boolean, errorMessage?: string): VerifyStage {
  if (success) return 'applied';
  const m = (errorMessage || '').toLowerCase();

  // Infrastructure first — "Invalid BROWSERLESS_WS_ENDPOINT" must not read as an invalid code
  if (isBrowserStartFailure(m)) return 'browser_connect';
  if (isProxyFailure(m)) return 'proxy_auth';

  // browserBot categorized prefixes
  const prefix = m.match(/^\s*\[([a-z_]+)\]/)?.[1];
  if (prefix === 'code_rejected') return 'applied';
  if (prefix === 'bot_blocked') return 'bot_blocked';
  if (prefix === 'cart_bootstrap_failed') return 'cart_bootstrap';
  if (prefix === 'no_promo_field') return 'no_promo_field';
  if (prefix === 'timeout') return 'timeout';

  if (m.includes('bot_blocked') || m.includes('blocking automation')) return 'bot_blocked';
  if (m.includes('cart_bootstrap_failed')) return 'cart_bootstrap';
  if (m.includes('no_promo_field') || m.includes('could not locate promo')) return 'no_promo_field';
  if (m.includes('timeout')) return 'timeout';
  if (m.includes('net::') || m.includes('navigation')) return 'navigation';
  if (
    m.includes('code_rejected') ||
    m.includes('expired') ||
    m.includes('invalid') ||
    m.includes('not valid') ||
    m.includes('not applicable')
  ) {
    return 'applied';
  }
  return 'unknown';
}

/** Route-level failure = nothing reached the store (retry on the next browser route). */
function isPreStoreRouteFailure(errorMessage?: string): boolean {
  const stage = classifyStage(false, errorMessage);
  return stage === 'browser_connect' || stage === 'proxy_auth';
}

/**
 * Hosted browser session lost / refused mid-run (quota hit, rate limit, remote
 * disconnect). Only used to decide whether to retry on the next provider when NO
 * code reached the promo field — it never changes how a result is counted.
 */
function isHostedSessionLost(errorMessage?: string): boolean {
  const m = (errorMessage || '').toLowerCase();
  // A store-side block (incl. store HTTP 429 pages) is not a provider failure
  if (m.includes('bot_blocked') || m.includes('blocking automation')) return false;
  return (
    isQuotaOrAuthRefusal(0, m) ||
    /\b(402|429)\b/.test(m) ||
    m.includes('session closed') ||
    m.includes('target closed') ||
    m.includes('browser has disconnected') ||
    m.includes('connection closed') ||
    m.includes('websocket is not open')
  );
}

// ---------------------------------------------------------------------------
// Confidence scoring
// ---------------------------------------------------------------------------

interface ConfidenceFactors {
  browserTestPassed: boolean;
  discountDetected: boolean;
  discountAmount?: string;
  responseTime: number;
  testRegion: string;
  errorMessage?: string;
}

function calculateConfidence(factors: ConfidenceFactors): number {
  // RULE: If the browser test failed, confidence can NEVER be >= 85
  // (the threshold for 'verified' status). This is the core integrity gate.
  if (!factors.browserTestPassed) {
    let base = 20;

    // Reduce further based on error type
    if (factors.errorMessage) {
      const err = factors.errorMessage.toLowerCase();
      if (err.includes('expired'))    base = 5;
      if (err.includes('invalid') || err.includes('code_rejected')) base = 5;
      if (err.includes('not found'))  base = 10;
      if (err.includes('timeout'))    base = 15;
      if (err.includes('bot_blocked') || err.includes('cart_bootstrap_failed')) base = 10;
      if (err.includes('no_promo_field')) base = 12;
      if (isBrowserStartFailure(err) || isProxyFailure(err)) base = 0;
    }

    return Math.max(0, base);
  }

  // Browser test passed — build confidence up
  let confidence = 60; // Base for a passed browser test

  // Actual discount was detected in the page (strongest signal)
  if (factors.discountDetected) confidence += 20;

  // A specific dollar/percent amount was extracted
  if (factors.discountAmount) confidence += 10;

  // Response time bonus (faster = store responded cleanly)
  if (factors.responseTime < 5000)       confidence += 5;
  else if (factors.responseTime < 10000) confidence += 3;

  // Non-global region test is more reliable
  if (factors.testRegion !== 'GLOBAL') confidence += 5;

  return Math.min(100, confidence);
}

// ---------------------------------------------------------------------------
// Status determination — strict rules
// ---------------------------------------------------------------------------

function determineStatus(
  browserTestPassed: boolean,
  confidence: number,
  errorMessage: string | undefined,
  stage: VerifyStage
): CodeVerificationResult['status'] {
  if (!browserTestPassed) {
    // Never reached the promo field → 'error' (could not test), NOT 'failed' (rejected)
    if (stage !== 'applied') return 'error';
    const err = (errorMessage || '').toLowerCase();
    if (err.includes('expired')) return 'expired';
    return 'failed';
  }

  // Passed browser test — MUST meet confidence threshold
  // 85+ = verified (real savings detected at checkout)
  if (confidence >= 85) return 'verified';

  // Passed but not enough confidence signals
  return 'unverified';
}

function resultFromBrowser(
  candidate: CandidateCode,
  region: string,
  success: boolean,
  responseTime: number,
  lastError: string | undefined,
  discountText: string | undefined,
  discountAmount: string | undefined
): CodeVerificationResult {
  const confidence = calculateConfidence({
    browserTestPassed: success,
    discountDetected: !!(discountText || discountAmount),
    discountAmount,
    responseTime,
    testRegion: region,
    errorMessage: lastError,
  });

  const stage = classifyStage(success, lastError);
  const status = determineStatus(success, confidence, lastError, stage);
  const reachedPromoField = stage === 'applied';

  const why = !reachedPromoField && lastError ? ` — ${lastError.slice(0, 160)}` : '';
  console.log(
    `  ${status === 'verified' ? '✓' : '✗'} ${candidate.code}: ${status} ` +
      `[${reachedPromoField ? 'applied' : `not tested: ${stage}`}] (confidence: ${confidence}%)${why}`
  );

  return {
    code: candidate.code,
    status,
    confidence,
    discountText,
    discountAmount,
    errorMessage: lastError,
    testedAt: new Date().toISOString(),
    testRegion: region,
    responseTime,
    terms: extractTerms(candidate.description),
    reachedPromoField,
    stage,
  };
}

function notTestedResult(
  code: string,
  region: string,
  stage: VerifyStage,
  errorMessage: string
): CodeVerificationResult {
  return {
    code,
    status: 'error',
    confidence: 0,
    errorMessage,
    testedAt: new Date().toISOString(),
    testRegion: region,
    responseTime: 0,
    terms: [],
    reachedPromoField: false,
    stage,
  };
}

// ---------------------------------------------------------------------------
// Verify a single code (direct API / fallback)
// ---------------------------------------------------------------------------

async function verifySingleCode(
  merchant: MerchantInfo,
  candidate: CandidateCode,
  region: string,
  proxyOverride?: ProxyConfig
): Promise<CodeVerificationResult> {
  // Prefer caller-provided proxy (same rotating session for the batch); else fresh geo session
  const proxy = proxyOverride ?? getGeoLocation(region, { rotateSession: true }).proxy;

  console.log(`  Testing: ${candidate.code}`);

  let success = false;
  let responseTime = 0;
  let lastError: string | undefined;
  let discountText: string | undefined;
  let discountAmount: string | undefined;

  try {
    const result = await simulateCheckout(
      merchant.url,
      candidate.code,
      proxy,
      PER_CODE_TIMEOUT_MS
    );

    success = result.success;
    responseTime = result.pageLoadTime || 0;
    lastError = result.errorMessage;
    discountText = result.discountText;
    discountAmount = result.discountAmount;
  } catch (error) {
    lastError = error instanceof Error ? error.message : 'Simulation failed';
    console.warn(`  ✗ ${candidate.code}: ${lastError}`);
  }

  return resultFromBrowser(
    candidate,
    region,
    success,
    responseTime,
    lastError,
    discountText,
    discountAmount
  );
}

function isInfrastructureFailure(errorMessage?: string): boolean {
  const err = (errorMessage || '').toLowerCase();
  return (
    err.includes('timeout') ||
    err.includes('[timeout]') ||
    err.includes('bot_blocked') ||
    err.includes('cart_bootstrap_failed') ||
    err.includes('no_promo_field') ||
    err.includes('could not locate promo') ||
    err.includes('blocking automation') ||
    err.includes('net::') ||
    err.includes('navigation') ||
    isBrowserStartFailure(err) ||
    isProxyFailure(err)
  );
}

/**
 * Human detail for a route that failed before reaching the store (probe Browserless /
 * Cloudflare for the real HTTP reason). Puts the provider in cooldown on
 * 401/402/429/quota refusals so later routes/hunts skip it.
 */
async function describeRouteFailure(
  route: VerifyRoute,
  originalWs: string | undefined,
  errorMessage: string | undefined
): Promise<string> {
  const clean = (errorMessage || '').replace('[object Object]', '').trim();

  if (route.provider === 'kernel') {
    // Kernel refusals come from our REST create call, so the status is already in the message
    const status = Number(clean.match(/\(HTTP (\d{3})\)/)?.[1] || 0);
    const retryAfter = Number(clean.match(/Retry-After (\d+)s/)?.[1] || 0) || undefined;
    if (isQuotaOrAuthRefusal(status, clean)) {
      markProviderCooldown('kernel', cooldownMsFor(status, clean, retryAfter), `HTTP ${status || '?'}`);
    }
    return (clean || 'Kernel route failed').slice(0, 200);
  }

  if (route.provider === 'cloudflare') {
    let status = Number(clean.match(/\(HTTP (\d{3})\)/)?.[1] || 0);
    let detail = clean || 'Cloudflare route failed';
    let retryAfter: number | undefined;
    if (isBrowserStartFailure(errorMessage)) {
      const probe = await probeCloudflareHandshake();
      if (probe.status && probe.status !== 101) {
        status = probe.status;
        retryAfter = probe.retryAfterSec;
        detail =
          `HTTP ${probe.status}: ${probe.message || 'handshake refused'}` +
          (retryAfter ? ` (Retry-After ${retryAfter}s)` : '');
      } else if (probe.status === 0) {
        detail = `connect failed (${probe.message})`;
      }
    }
    if (isQuotaOrAuthRefusal(status, detail)) {
      markProviderCooldown('cloudflare', cooldownMsFor(status, detail, retryAfter), detail.slice(0, 120));
    }
    return detail.slice(0, 200);
  }

  if (route.provider === 'browserless' && isBrowserStartFailure(errorMessage)) {
    const probe = await probeBrowserlessHandshake(route, originalWs);
    if (probe.status && probe.status !== 101) {
      if (route.kind === 'browserless-external-proxy' && /paid|third-party proxy/i.test(probe.message)) {
        markExternalProxyRejected(`HTTP ${probe.status}: ${probe.message}`);
      } else if (probe.status === 402 || probe.status === 429 || isQuotaOrAuthRefusal(0, probe.message)) {
        // Plan quota / rate limit — skip the remaining Browserless routes for a while
        markProviderCooldown('browserless', cooldownMsFor(probe.status, probe.message), `HTTP ${probe.status}`);
      }
      return `HTTP ${probe.status}: ${probe.message || 'handshake refused'}`;
    }
    if (probe.status === 0) return `connect failed (${probe.message})`;
    return `probe handshake OK, puppeteer connect still failed: ${clean.slice(0, 160)}`;
  }
  return (clean || 'browser route failed').slice(0, 200);
}

// ---------------------------------------------------------------------------
// Honest summary
// ---------------------------------------------------------------------------

function summarize(results: CodeVerificationResult[]) {
  const stageCounts: Partial<Record<VerifyStage, number>> = {};
  for (const r of results) {
    const s = r.stage || 'unknown';
    stageCounts[s] = (stageCounts[s] || 0) + 1;
  }
  const tested = results.filter(r => r.reachedPromoField).length;
  const couldNotTest = results.length - tested;

  let dominant: VerifyStage | undefined;
  let best = 0;
  for (const [stage, n] of Object.entries(stageCounts) as [VerifyStage, number][]) {
    if (stage === 'applied' || stage === 'skipped') continue;
    if (n > best) {
      best = n;
      dominant = stage;
    }
  }
  if (!dominant && stageCounts.skipped) dominant = 'skipped';
  const couldNotTestReason = couldNotTest > 0 && dominant ? STAGE_LABELS[dominant] : undefined;

  return { stageCounts, tested, couldNotTest, couldNotTestReason };
}

// ---------------------------------------------------------------------------
// Verify all codes in a batch with overall timeout
// ---------------------------------------------------------------------------

export async function verifyCodes(request: VerificationRequest): Promise<VerificationResponse> {
  const { merchant, codes, testRegion } = request;

  console.log(`\n[Verifier] Starting: ${codes.length} codes for "${merchant.name}" (${testRegion})`);

  const results: CodeVerificationResult[] = [];
  // Owner hard rule: checkout-test EVERY candidate (no codes.slice(0, 5) product cap).
  const capped = codes;
  const batchTimeoutMs = batchTimeoutFor(capped.length);
  const batchDeadline = Date.now() + batchTimeoutMs;
  // One rotating residential session per hunt (country-matched); Chromium relaunches if proxy key changes
  const geo = getGeoLocation(testRegion, { rotateSession: true });
  if (geo.proxy) {
    console.log(
      `[Verifier] Geo proxy: ${geo.proxy.host}:${geo.proxy.port} ` +
        `user=${geo.proxy.username?.replace(/session-[a-f0-9]+/i, 'session-***') || '(none)'} ` +
        `(${geo.country})`
    );
  } else {
    console.log('[Verifier] Geo proxy: not configured — verifying on server IP');
  }

  console.log(
    `[Verifier] Batch budget: ${capped.length} codes → ${Math.round(batchTimeoutMs / 1000)}s ` +
      `(per-code ${PER_CODE_TIMEOUT_MS / 1000}s, max ${BATCH_TIMEOUT_MAX_MS / 1000}s)`
  );

  // Browserless built-in residential proxy follows the user's testRegion country.
  // GLOBAL (no country) → BROWSERLESS_DEFAULT_PROXY_COUNTRY (default US), logged,
  // instead of silently dropping to a datacenter IP.
  const regionCountry =
    geo.countryCode && geo.countryCode !== 'XX' ? geo.countryCode.toLowerCase() : undefined;
  const defaultProxyCountry = (process.env.BROWSERLESS_DEFAULT_PROXY_COUNTRY || 'us').trim().toLowerCase();
  const proxyCountry = regionCountry || defaultProxyCountry || undefined;
  console.log(
    `[Verifier] Built-in residential proxyCountry=${proxyCountry || 'none'} ` +
      (regionCountry
        ? `(from testRegion ${testRegion})`
        : `(testRegion ${testRegion} has no country → default ${(proxyCountry || 'none').toUpperCase()})`)
  );
  const originalWs = process.env.BROWSERLESS_WS_ENDPOINT;
  const routes = planVerifyRoutes(geo.proxy, proxyCountry);
  let activeRoute: VerifyRoute = routes[routes.length - 1];
  let activeProxy: ProxyConfig | undefined = activeRoute.proxy;
  const routeFailures: string[] = [];
  /** Set when every browser route failed before reaching the store */
  let allRoutesFailed: { stage: VerifyStage; message: string } | null = null;
  /** Last route failure (used when the remaining routes are skipped by cooldown) */
  let lastRouteFailure: { stage: VerifyStage; message: string } | null = null;
  let reachedStore = false;
  const batchStartedAt = Date.now();
  /** When the active route's browser work started (browser-seconds logging) */
  let routeStartedAt = Date.now();

  // Prefer one cart session: bootstrap → checkout promo → apply each → abandon
  // Falls back to per-code simulateCheckout if the batch helper throws hard.
  let browserResults: Awaited<ReturnType<typeof simulateCheckoutBatch>> | null = null;
  let browserSeconds = 0;

  try {
    for (let r = 0; r < routes.length; r++) {
      const route = routes[r];
      const hasNext = r < routes.length - 1;

      // A provider refused earlier in THIS batch (401/402/429/quota) — skip its other routes
      const cd = providerCooldown(route.provider);
      if (cd && cd.since >= batchStartedAt) {
        routeFailures.push(`${route.label}: skipped (${PROVIDER_LABELS[route.provider]} cooling down: ${cd.reason})`);
        console.warn(
          `[Verifier] Skipping ${route.label} — ${PROVIDER_LABELS[route.provider]} cooling down ` +
            `(${Math.round(cd.remainingMs / 1000)}s left: ${cd.reason})`
        );
        continue;
      }

      activeRoute = route;
      routeStartedAt = Date.now();
      console.log(`[Verifier] Browser provider: ${route.provider} (${route.label})`);
      activeProxy = await applyVerifyRoute(route, originalWs);

      let batch: Awaited<ReturnType<typeof simulateCheckoutBatch>> | null = null;
      let batchErr: string | undefined;
      try {
        console.log(
          `[Verifier] Cart-session verify: bootstrap → checkout-stage promo → abandon (${capped.length} codes)`
        );
        batch = await simulateCheckoutBatch(
          merchant.url,
          capped.map(c => c.code),
          activeProxy,
          PER_CODE_TIMEOUT_MS
        );
      } catch (err) {
        batchErr = err instanceof Error ? err.message : String(err);
        console.warn('[Verifier] Batch session failed:', batchErr);
      }

      const firstErr = batch?.find(b => !b.success)?.errorMessage || batchErr;
      const preStore = batch
        ? batch.length > 0 && batch.every(b => !b.success && isPreStoreRouteFailure(b.errorMessage))
        : isPreStoreRouteFailure(batchErr);

      // Hosted session refused / lost mid-run (quota, rate limit, remote disconnect) before ANY
      // code reached the promo field → retry the whole batch on the next provider. Results
      // from this route are discarded, never counted.
      const sessionLost =
        !preStore &&
        route.provider !== 'local' &&
        hasNext &&
        Date.now() < batchDeadline &&
        !!batch &&
        batch.length > 0 &&
        batch.every(b => !b.success && classifyStage(false, b.errorMessage) !== 'applied') &&
        isHostedSessionLost(firstErr);

      if (!preStore && !sessionLost) {
        // Store was reached (or batch helper threw for another reason → per-code fallback below)
        browserResults = batch;
        reachedStore = true;
        break;
      }

      const detail = sessionLost
        ? `hosted session lost before any code was applied (${(firstErr || '').replace('[object Object]', '').slice(0, 160)})`
        : await describeRouteFailure(route, originalWs, firstErr);
      if (sessionLost && isQuotaOrAuthRefusal(0, firstErr || '')) {
        markProviderCooldown(route.provider, cooldownMsFor(0, firstErr || ''), 'quota / rate limit mid-session');
      }
      const routeSecs = ((Date.now() - routeStartedAt) / 1000).toFixed(1);
      routeFailures.push(`${route.label}: ${detail}`);
      console.warn(
        `[Verifier] Route failed before reaching the store — ${route.label}: ${detail} ` +
          `(provider=${route.provider}, ${routeSecs}s)` +
          (hasNext ? ' → falling back to next browser route' : ' → no routes left')
      );
      lastRouteFailure = {
        stage: classifyStage(false, firstErr),
        message: `${(firstErr || 'Browser route failed').replace('[object Object]', '').trim()} ${detail}`.trim(),
      };
      if (!hasNext) {
        allRoutesFailed = lastRouteFailure;
      }
    }

    // Every remaining route was skipped by cooldown after a failure → nothing reached the store
    if (!reachedStore && !allRoutesFailed) {
      allRoutesFailed = lastRouteFailure || {
        stage: 'browser_connect',
        message: 'Failed to connect to any hosted browser provider (all providers cooling down)',
      };
    }

    let storeUnreachable = false;
    let storeUnreachableReason = '';
    let botBlockSoftRetryUsed = false;

    for (let i = 0; i < capped.length; i++) {
      const candidate = capped[i];

      if (allRoutesFailed) {
        results.push(notTestedResult(candidate.code, testRegion, allRoutesFailed.stage, allRoutesFailed.message));
        continue;
      }

      if (Date.now() > batchDeadline) {
        console.warn('[Verifier] Batch timeout reached — stopping early');
        const remaining = capped.slice(results.length);
        for (const c of remaining) {
          results.push(
            notTestedResult(c.code, testRegion, 'timeout', '[timeout] Verification timeout — batch took too long')
          );
        }
        break;
      }

      if (storeUnreachable) {
        results.push(
          notTestedResult(
            candidate.code,
            testRegion,
            'skipped',
            storeUnreachableReason || 'Skipped — store checkout unreachable for this batch'
          )
        );
        continue;
      }

      let result: CodeVerificationResult;

      if (browserResults && browserResults[i]) {
        const br = browserResults[i];
        result = resultFromBrowser(
          candidate,
          testRegion,
          br.success,
          br.pageLoadTime || 0,
          br.errorMessage,
          br.discountText,
          br.discountAmount
        );
      } else {
        result = await verifySingleCode(merchant, candidate, testRegion, activeProxy);
      }

      results.push(result);

      // Circuit breaker only in per-code mode: batch results were already all attempted,
      // so overwriting later real outcomes with "skipped" would hide what actually happened.
      if (!browserResults && result.status === 'error' && isInfrastructureFailure(result.errorMessage)) {
        const msg = (result.errorMessage || '').toLowerCase();
        const isBot = msg.includes('bot_blocked') || msg.includes('[bot_blocked]');
        // Soft retry once on bot_blocked: pause with longer delay, then continue one more code
        // before aborting remaining — don't burn the whole queue into the same block.
        if (isBot && !botBlockSoftRetryUsed) {
          botBlockSoftRetryUsed = true;
          const pauseMs = 10_000 + Math.floor(Math.random() * 8_000);
          console.warn(
            `[Verifier] bot_blocked on ${candidate.code} — soft pause ${pauseMs}ms once before continuing`
          );
          await new Promise(r => setTimeout(r, pauseMs));
        } else {
          storeUnreachable = true;
          storeUnreachableReason = isBot
            ? 'Store bot-blocked after soft retry — remaining codes aborted this batch'
            : 'Store checkout unreachable (timeout/blocked/cart/promo) — remaining codes not retested this batch';
          console.warn(`[Verifier] Circuit breaker armed after ${candidate.code}: ${result.errorMessage}`);
        }
      }

      if (results.length < capped.length && !storeUnreachable && !browserResults) {
        await new Promise(r => setTimeout(r, Math.floor(Math.random() * 1000) + 500));
      }
    }
  } finally {
    browserSeconds = Math.round((Date.now() - routeStartedAt) / 100) / 10;
    console.log(
      `[Verifier] Browser usage: provider=${activeRoute.provider} route="${activeRoute.label}" ` +
        `browserSeconds=${browserSeconds}`
    );
    // Kernel / Cloudflare are metered per session — end them now (Kernel: delete by id)
    await releaseHostedBrowser().catch(err =>
      console.warn('[Verifier] Hosted browser release failed:', err instanceof Error ? err.message : err)
    );
    restoreWsEndpoint(originalWs);
  }

  // Public ledger = simulated-checkout outcomes only; codes that never reached the promo field are not "fail" rows
  for (const result of results) {
    if (!result.reachedPromoField) continue;
    try {
      await appendLedgerFromResult(merchant, result, testRegion);
    } catch (ledgerErr) {
      console.warn(
        '[Verifier] Ledger append failed:',
        ledgerErr instanceof Error ? ledgerErr.message : ledgerErr
      );
    }
  }

  const successful = results.filter(r => r.status === 'verified').length;
  const failed = results.filter(r => r.reachedPromoField && (r.status === 'failed' || r.status === 'expired')).length;
  const { stageCounts, tested, couldNotTest, couldNotTestReason } = summarize(results);

  const testSummary =
    tested === 0 && couldNotTest > 0
      ? `0 of ${results.length} codes could be tested: ${couldNotTestReason || 'checkout not reached'}`
      : `${tested} of ${results.length} codes tested at the promo field ` +
        `(${successful} verified, ${failed} rejected)` +
        (couldNotTest > 0
          ? `; ${couldNotTest} could not be tested${couldNotTestReason ? `: ${couldNotTestReason}` : ''}`
          : '');

  const browserRoute =
    activeRoute.label + (routeFailures.length ? ` (fallbacks: ${routeFailures.join(' | ')})` : '');

  console.log(
    `[Verifier] Complete: ${successful} verified, ${failed} rejected, ${couldNotTest} could not be tested ` +
      `(of ${results.length}) | stages=${JSON.stringify(stageCounts)}`
  );
  console.log(
    `[Verifier] ${testSummary} | route: ${browserRoute} | provider=${activeRoute.provider} browserSeconds=${browserSeconds}\n`
  );

  return {
    merchant,
    results,
    totalTested: tested,
    successful,
    failed,
    testedAt: new Date().toISOString(),
    region: testRegion,
    totalAttempted: results.length,
    couldNotTest,
    couldNotTestReason,
    stageCounts,
    testSummary,
    browserRoute,
    browserProvider: activeRoute.provider,
    browserSeconds,
  };
}

// ---------------------------------------------------------------------------
// Extract T&C snippets from description text
// ---------------------------------------------------------------------------

function extractTerms(description: string): string[] {
  const terms: string[] = [];
  if (!description) return terms;

  const minSpend = description.match(/min\.?\s*(?:spend|order|purchase).*?\$?[\d]+/i);
  if (minSpend) terms.push(minSpend[0].trim());

  const percentMatch = description.match(/\d+\s*%\s*off/i);
  if (percentMatch) terms.push(percentMatch[0]);

  const expiryMatch = description.match(/exp(?:ires?|iry)[^.]{0,30}/i);
  if (expiryMatch) terms.push(expiryMatch[0].trim());

  const newCustomer = description.match(/new\s*custom(?:er|ers?)/i);
  if (newCustomer) terms.push('New customers only');

  const firstOrder = description.match(/first\s*(?:order|purchase)/i);
  if (firstOrder) terms.push('First order only');

  return terms;
}

// ---------------------------------------------------------------------------
// Public single-code verification (for direct API access)
// ---------------------------------------------------------------------------

export async function verifySingleCodePublic(
  merchantUrl: string,
  code: string,
  region: string = 'US'
): Promise<CodeVerificationResult> {
  const merchant: MerchantInfo = {
    name: new URL(merchantUrl).hostname.replace('www.', ''),
    url: merchantUrl,
    region,
  };
  const candidate: CandidateCode = {
    code,
    description: 'Direct API verification',
    source: 'API',
    discoveredAt: new Date().toISOString(),
  };
  try {
    return await verifySingleCode(merchant, candidate, region);
  } finally {
    // Direct API path has no route loop — still end metered Kernel/Cloudflare sessions
    await releaseHostedBrowser().catch(() => {});
  }
}
