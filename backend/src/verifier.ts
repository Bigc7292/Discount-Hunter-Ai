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
 */

import type {
  CandidateCode,
  MerchantInfo,
  VerificationRequest,
  VerificationResponse,
  CodeVerificationResult
} from './types.js';
import { getGeoLocation } from './geoProxy.js';
import { simulateCheckout, simulateCheckoutBatch } from './browserBot.js';
import { appendLedgerFromResult } from './ledger.js';

// Maximum time to verify ALL codes in a batch (cart bootstrap + checkout is slower)
const BATCH_TIMEOUT_MS = 300_000; // 5 minutes

// Per-code budget inside a cart session (apply + read)
const PER_CODE_TIMEOUT_MS = 60_000;

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
  errorMessage?: string
): CodeVerificationResult['status'] {
  // Failed at checkout
  if (!browserTestPassed) {
    if (errorMessage) {
      const err = errorMessage.toLowerCase();
      if (err.includes('expired'))  return 'expired';
      if (err.includes('invalid') || err.includes('not valid') || err.includes('not found') || err.includes('code_rejected')) return 'failed';
      if (
        err.includes('timeout') ||
        err.includes('could not locate') ||
        err.includes('bot_blocked') ||
        err.includes('cart_bootstrap_failed') ||
        err.includes('no_promo_field')
      ) {
        return 'error';
      }
    }
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

  const status = determineStatus(success, confidence, lastError);

  console.log(`  ${status === 'verified' ? '✓' : '✗'} ${candidate.code}: ${status} (confidence: ${confidence}%)`);

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
  };
}

// ---------------------------------------------------------------------------
// Verify a single code (direct API / fallback)
// ---------------------------------------------------------------------------

async function verifySingleCode(
  merchant: MerchantInfo,
  candidate: CandidateCode,
  region: string
): Promise<CodeVerificationResult> {
  const geo = getGeoLocation(region);

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
      geo.proxy,
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
    err.includes('navigation')
  );
}

// ---------------------------------------------------------------------------
// Verify all codes in a batch with overall timeout
// ---------------------------------------------------------------------------

export async function verifyCodes(request: VerificationRequest): Promise<VerificationResponse> {
  const { merchant, codes, testRegion } = request;

  console.log(`\n[Verifier] Starting: ${codes.length} codes for "${merchant.name}" (${testRegion})`);

  const results: CodeVerificationResult[] = [];
  const batchDeadline = Date.now() + BATCH_TIMEOUT_MS;

  // Cap batch size — more codes rarely help when cart navigation is blocked
  const capped = codes.slice(0, 5);
  const geo = getGeoLocation(testRegion);

  // Prefer one cart session: bootstrap → checkout promo → apply each → abandon
  // Falls back to per-code simulateCheckout if the batch helper throws hard.
  let browserResults: Awaited<ReturnType<typeof simulateCheckoutBatch>> | null = null;

  try {
    console.log(
      `[Verifier] Cart-session verify: bootstrap → checkout-stage promo → abandon (${capped.length} codes)`
    );
    browserResults = await simulateCheckoutBatch(
      merchant.url,
      capped.map(c => c.code),
      geo.proxy,
      PER_CODE_TIMEOUT_MS
    );
  } catch (batchErr) {
    console.warn(
      '[Verifier] Batch session failed, falling back to per-code:',
      batchErr instanceof Error ? batchErr.message : batchErr
    );
  }

  let storeUnreachable = false;
  let storeUnreachableReason = '';

  for (let i = 0; i < capped.length; i++) {
    const candidate = capped[i];

    if (Date.now() > batchDeadline) {
      console.warn('[Verifier] Batch timeout reached — stopping early');
      const remaining = capped.slice(results.length);
      for (const c of remaining) {
        const timeoutResult = {
          code: c.code,
          status: 'error' as const,
          confidence: 0,
          errorMessage: '[timeout] Verification timeout — batch took too long',
          testedAt: new Date().toISOString(),
          testRegion,
          responseTime: 0,
          terms: [] as string[],
        };
        results.push(timeoutResult);
        try {
          await appendLedgerFromResult(merchant, timeoutResult, testRegion);
        } catch {
          /* non-fatal */
        }
      }
      break;
    }

    if (storeUnreachable) {
      const skipResult = {
        code: candidate.code,
        status: 'error' as const,
        confidence: 0,
        errorMessage:
          storeUnreachableReason ||
          'Skipped — store checkout unreachable for this batch',
        testedAt: new Date().toISOString(),
        testRegion,
        responseTime: 0,
        terms: [] as string[],
      };
      results.push(skipResult);
      try {
        await appendLedgerFromResult(merchant, skipResult, testRegion);
      } catch {
        /* non-fatal */
      }
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
      result = await verifySingleCode(merchant, candidate, testRegion);
    }

    results.push(result);

    if (result.status === 'error' && isInfrastructureFailure(result.errorMessage)) {
      storeUnreachable = true;
      storeUnreachableReason =
        'Store checkout unreachable (timeout/blocked/cart/promo) — remaining codes not retested this batch';
      console.warn(`[Verifier] Circuit breaker armed after ${candidate.code}: ${result.errorMessage}`);
    }

    try {
      await appendLedgerFromResult(merchant, result, testRegion);
    } catch (ledgerErr) {
      console.warn(
        '[Verifier] Ledger append failed:',
        ledgerErr instanceof Error ? ledgerErr.message : ledgerErr
      );
    }

    if (results.length < capped.length && !storeUnreachable && !browserResults) {
      await new Promise(r => setTimeout(r, Math.floor(Math.random() * 1000) + 500));
    }
  }

  const successful = results.filter(r => r.status === 'verified').length;
  const failed = results.filter(r => r.status === 'failed' || r.status === 'expired').length;
  const unverified = results.filter(r => r.status === 'unverified' || r.status === 'error').length;

  console.log(
    `[Verifier] Complete: ${successful} verified, ${failed} failed, ${unverified} unverified\n`
  );

  return {
    merchant,
    results,
    totalTested: results.length,
    successful,
    failed,
    testedAt: new Date().toISOString(),
    region: testRegion,
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
  return verifySingleCode(merchant, candidate, region);
}