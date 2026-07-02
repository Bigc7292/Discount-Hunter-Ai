/**
 * Verifier — Orchestrates real checkout testing for each candidate code
 *
 * Improvements:
 * - Strict confidence gate: browserTestPassed MUST be true for 'verified' status
 * - discountText and discountAmount passed through to response
 * - Per-code 35s timeout (from browserBot)
 * - Overall batch timeout: 3 minutes max for all codes
 * - Better confidence scoring with real factors
 */

import type {
  CandidateCode,
  MerchantInfo,
  VerificationRequest,
  VerificationResponse,
  CodeVerificationResult
} from './types';
import { getGeoLocation } from './geoProxy';
import { simulateCheckout } from './browserBot';

// Maximum time to verify ALL codes in a batch
const BATCH_TIMEOUT_MS = 180_000; // 3 minutes

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
      if (err.includes('invalid'))    base = 5;
      if (err.includes('not found'))  base = 10;
      if (err.includes('timeout'))    base = 15;
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
      if (err.includes('invalid') || err.includes('not valid') || err.includes('not found')) return 'failed';
      if (err.includes('timeout') || err.includes('could not locate')) return 'error';
    }
    return 'failed';
  }

  // Passed browser test — MUST meet confidence threshold
  // 85+ = verified (real savings detected at checkout)
  if (confidence >= 85) return 'verified';

  // Passed but not enough confidence signals
  return 'unverified';
}

// ---------------------------------------------------------------------------
// Verify a single code
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
      35000 // 35s per code
    );

    success        = result.success;
    responseTime   = result.pageLoadTime || 0;
    lastError      = result.errorMessage;
    discountText   = result.discountText;
    discountAmount = result.discountAmount;

  } catch (error) {
    lastError = error instanceof Error ? error.message : 'Simulation failed';
    console.warn(`  ✗ ${candidate.code}: ${lastError}`);
  }

  const confidence = calculateConfidence({
    browserTestPassed:  success,
    discountDetected:   !!(discountText || discountAmount),
    discountAmount,
    responseTime,
    testRegion:         region,
    errorMessage:       lastError,
  });

  const status = determineStatus(success, confidence, lastError);

  console.log(`  ${status === 'verified' ? '✓' : '✗'} ${candidate.code}: ${status} (confidence: ${confidence}%)`);

  return {
    code:           candidate.code,
    status,
    confidence,
    discountText,
    discountAmount,
    errorMessage:   lastError,
    testedAt:       new Date().toISOString(),
    testRegion:     region,
    responseTime,
    terms:          extractTerms(candidate.description),
  };
}

// ---------------------------------------------------------------------------
// Verify all codes in a batch with overall timeout
// ---------------------------------------------------------------------------

export async function verifyCodes(request: VerificationRequest): Promise<VerificationResponse> {
  const { merchant, codes, testRegion } = request;

  console.log(`\n[Verifier] Starting: ${codes.length} codes for "${merchant.name}" (${testRegion})`);

  const results: CodeVerificationResult[] = [];
  const batchDeadline = Date.now() + BATCH_TIMEOUT_MS;

  for (const candidate of codes) {
    // Check if we've exceeded the batch time limit
    if (Date.now() > batchDeadline) {
      console.warn('[Verifier] Batch timeout reached — stopping early');
      // Mark remaining codes as error
      const remaining = codes.slice(results.length);
      for (const c of remaining) {
        results.push({
          code: c.code,
          status: 'error',
          confidence: 0,
          errorMessage: 'Verification timeout — batch took too long',
          testedAt: new Date().toISOString(),
          testRegion,
          responseTime: 0,
          terms: [],
        });
      }
      break;
    }

    const result = await verifySingleCode(merchant, candidate, testRegion);
    results.push(result);

    // Small pause between codes (be a respectful bot)
    if (results.length < codes.length) {
      await new Promise(r => setTimeout(r, Math.floor(Math.random() * 1000) + 500));
    }
  }

  const successful  = results.filter(r => r.status === 'verified').length;
  const failed      = results.filter(r => r.status === 'failed' || r.status === 'expired').length;
  const unverified  = results.filter(r => r.status === 'unverified' || r.status === 'error').length;

  console.log(`[Verifier] Complete: ${successful} verified, ${failed} failed, ${unverified} unverified\n`);

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
