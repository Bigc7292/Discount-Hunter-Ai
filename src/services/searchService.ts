/**
 * Search Service — Core Pipeline Orchestrator
 *
 * Pipeline: Health Check → Discovery (NVIDIA AI) → Verification (Backend/Puppeteer) → Display
 *
 * STRICT RULES / LAUNCH INVARIANT:
 * 1. If the verifier backend is offline → HARD STOP. Zero codes shown. Never fallback.
 * 2. Only codes with status === 'verified' (confirmed at real checkout) are returned.
 * 3. Discovery codes that fail or are unverified are SILENTLY DROPPED — never shown in any UI path.
 * 4. Influencer/social signals stay internal — never surfaced as copyable codes.
 */

import { CouponCode, SearchResult, SearchStatus, LogEntry } from '../types';
import { findInfluencerCodes, checkGlitchProbability, generateLogMessage } from './nvidiaService';
import { checkVerifierHealth, discoverCodes } from './apiService';

// Per-code + batch budgets — MUST stay aligned with backend/src/verifier.ts
// Owner hard rule: checkout-test EVERY discovery candidate (no MAX_CODES_TO_VERIFY cap).
const PER_CODE_VERIFY_MS = 55_000;
const VERIFY_BOOTSTRAP_BUFFER_MS = 120_000;
/** Hard ceiling (~20 min) + client slack; Render free may kill sooner — see AGENTS.md */
const VERIFY_BATCH_MAX_MS = 1_200_000;

/** Frontend abort aligned with backend batchTimeoutFor(N). */
function verifierTimeoutFor(codeCount: number): number {
  const n = Math.max(1, codeCount);
  return Math.min(
    VERIFY_BATCH_MAX_MS + 60_000,
    VERIFY_BOOTSTRAP_BUFFER_MS + n * PER_CODE_VERIFY_MS
  );
}

const VERIFIER_URL = import.meta.env.VITE_VERIFIER_API_URL ||
  (import.meta.env.PROD
    ? 'https://discount-hunter-backend-oz8e.onrender.com'
    : 'http://localhost:3001');

type LogHandler = (message: string, type: LogEntry['type']) => void;

// ---------------------------------------------------------------------------
// Internal verification request with proper timeout
// ---------------------------------------------------------------------------

interface VerificationResult {
  code: string;
  status: 'verified' | 'failed' | 'expired' | 'error' | 'unverified';
  confidence: number;
  testedRegion: string;
  testedAt: string;
  codeDescription?: string;
  source?: string;
  errorMessage?: string;
  discountText?: string;
  discountAmount?: string;
  responseTime?: number;
}

interface VerificationResponse {
  merchant: { name: string; url: string; region: string };
  results: VerificationResult[];
  totalTested: number;
  successful: number;
  failed: number;
  unverified: number;
  processingTimeMs: number;
}


/** Bucket non-verified error messages into a short UI-safe label (no codes). */
function dominantFailureReason(results: VerificationResult[]): string | undefined {
  const failed = results.filter(r => r.status !== 'verified');
  if (failed.length === 0) return undefined;

  const bucket = (r: VerificationResult): string => {
    const m = (r.errorMessage || '').toLowerCase();
    if (/\[bot_blocked\]|bot_blocked|challenge|access denied/.test(m)) return 'store blocked automation';
    if (/\[timeout\]|timeout|slow or blocking/.test(m)) return 'page load timeout';
    if (/\[cart_bootstrap_failed\]|cart_bootstrap_failed/.test(m)) return 'could not add item to cart';
    if (/\[no_promo_field\]|no_promo_field|empty cart|no promo field|item may be required/.test(m)) {
      return 'empty cart or no promo field';
    }
    if (/could not locate promo/.test(m)) return 'no promo field on cart';
    if (/\[code_rejected\]|code_rejected|no discount|no promo/.test(m)) return 'code rejected / no discount signal';
    if (/invalid|not valid|expired|rejected|not applicable/.test(m) || r.status === 'expired' || r.status === 'failed') {
      return 'invalid or rejected at checkout';
    }
    if (r.status === 'error') return 'verifier error';
    return 'checkout did not confirm';
  };

  const counts = new Map<string, number>();
  for (const r of failed) {
    const key = bucket(r);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let best = '';
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best || undefined;
}

async function runVerification(
  merchantName: string,
  merchantUrl: string,
  codes: { code: string; description: string; source?: string; sourceUrl?: string }[],
  region: string
): Promise<VerificationResponse> {
  const timeoutMs = verifierTimeoutFor(codes.length);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${VERIFIER_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant: { name: merchantName, url: merchantUrl },
        codes,
        testRegion: region,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`Verifier responded with HTTP ${response.status}`);
    }

    return await response.json() as VerificationResponse;

  } catch (error) {
    clearTimeout(timer);
    throw error; // Re-throw — caller decides how to handle
  }
}

// ---------------------------------------------------------------------------
// Main search pipeline
// ---------------------------------------------------------------------------

export async function runSearch(
  query: string,
  region: string,
  userId: string | null,
  addLog: LogHandler,
  setStatus: (s: SearchStatus) => void,
  setResult: (r: SearchResult | null) => void,
  setInfluencerCodes: (c: CouponCode[]) => void,
  setGlitchStatus: (s: { probability: number; warning?: string } | null) => void
): Promise<void> {
  const startTime = Date.now();
  const regionLabel = region || 'GLOBAL';

  // ─── PHASE 0: VERIFIER HEALTH CHECK ───────────────────────────────────────
  // Before doing anything expensive, confirm the backend is reachable.
  // If it's offline, we stop immediately. No codes can be shown without verification.

  setStatus(SearchStatus.PLANNING);
  addLog('INITIALISING HUNTER PROTOCOL...', 'system');
  addLog('CHECKING VERIFICATION NETWORK STATUS...', 'info');

  const verifierOnline = await checkVerifierHealth();

  if (!verifierOnline) {
    addLog('⛔ VERIFICATION NETWORK OFFLINE', 'error');
    addLog('MISSION ABORTED: Cannot return unverified codes. Please try again shortly.', 'error');
    setStatus(SearchStatus.VERIFIER_OFFLINE);
    setResult({
      merchantName: query,
      merchantUrl: '',
      codes: [],
      unverifiedCount: 0,
      competitors: [],
      verifierOnline: false,
      stats: {
        sourcesScanned: 0,
        codesDiscovered: 0,
        codesTested: 0,
        codesVerified: 0,
        timeTaken: '0s',
        moneySavedEstimate: '$0.00',
      },
    });
    return;
  }

  addLog('✓ VERIFICATION NETWORK ONLINE', 'success');

  try {
    // ─── PHASE 1: SCANNING / DISCOVERY ──────────────────────────────────────
    setStatus(SearchStatus.SCANNING);
    addLog(`TARGET: "${query}" | REGION: ${regionLabel}`, 'system');

    const scanMsg = await generateLogMessage(query, 'scanning');
    addLog(scanMsg, 'info');

    setStatus(SearchStatus.DISCOVERING);
    addLog('ACCESSING NVIDIA AI DISCOVERY NETWORK...', 'info');

    const discovery = await discoverCodes(query, regionLabel);

    if (!discovery.merchantName || discovery.merchantName === query) {
      // Try to be more helpful with the merchant name
      addLog(`TARGET IDENTIFIED: ${discovery.merchantName}`, 'info');
    } else {
      addLog(`✓ TARGET ACQUIRED: ${discovery.merchantName}`, 'success');
    }

    const discovered = discovery.suggestedCodes;
    addLog(
      `DISCOVERY COMPLETE: ${discovered.length} CANDIDATE CODE${discovered.length !== 1 ? 'S' : ''} LOCATED`,
      discovered.length > 0 ? 'info' : 'warning'
    );

    if (discovered.length === 0) {
      setStatus(SearchStatus.COMPLETE);
      setResult({
        merchantName: discovery.merchantName,
        merchantUrl: discovery.merchantUrl,
        codes: [],
        unverifiedCount: 0,
        competitors: discovery.competitors,
        verifierOnline: true,
        stats: {
          sourcesScanned: 0,
          codesDiscovered: 0,
          codesTested: 0,
          codesVerified: 0,
          timeTaken: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
          moneySavedEstimate: '$0.00',
        },
      });
      addLog('ZERO CANDIDATES DISCOVERED — NO KNOWN ACTIVE CODES FOR THIS TARGET', 'warning');
      return;
    }

    // ─── PHASE 2: REAL CHECKOUT VERIFICATION ────────────────────────────────
    setStatus(SearchStatus.VERIFYING);

    // Prefer digit-bearing codes (real promos); deprioritize all-letter scraps
    const ranked = [...discovered].sort((a, b) => {
      const score = (c: typeof a) => (/[0-9]/.test(c.code) ? 2 : 0) + (c.discoveryConfidence || 0);
      return score(b) - score(a);
    });
    // Owner hard rule: checkout-test EVERY discovery candidate (no hard cap).
    const toVerify = ranked;
    const budgetSec = Math.round(verifierTimeoutFor(toVerify.length) / 1000);
    addLog(
      `VERIFY QUEUE: ${discovered.length} discovered → ALL ${toVerify.length} sent for checkout test (budget ~${budgetSec}s, max ~20 min)`,
      'info'
    );
    addLog(`LAUNCHING HEADLESS BROWSER — TESTING ${toVerify.length} CODE${toVerify.length !== 1 ? 'S' : ''} AT REAL CHECKOUT...`, 'system');

    const validateMsg = await generateLogMessage(discovery.merchantName, 'validating');
    addLog(validateMsg, 'info');
    addLog(`REGION: ${regionLabel} | SIMULATING REAL CHECKOUT FLOW...`, 'info');

    let verificationResponse: VerificationResponse;

    try {
      verificationResponse = await runVerification(
        discovery.merchantName,
        discovery.merchantUrl,
        toVerify.map(c => ({
          code: c.code,
          description: c.description,
          source: c.source,
          sourceUrl: c.sourceUrl,
        })),
        regionLabel
      );
    } catch (verifyError) {
      // Verifier timed out / crashed mid-search — stay verify-only (no codes shown)
      // but use COMPLETE + honest counts so the UI is not a blank "zero results" void.
      const errMsg = verifyError instanceof Error ? verifyError.message : 'Unknown error';
      const timedOut =
        (verifyError instanceof DOMException && verifyError.name === 'AbortError') ||
        /abort|timeout/i.test(errMsg);
      addLog(
        timedOut
          ? `⛔ VERIFICATION TIMED OUT after ${((Date.now() - startTime) / 1000).toFixed(0)}s — store may block automation`
          : `⛔ VERIFICATION FAILED: ${errMsg}`,
        'error'
      );
      addLog(
        `HONEST RESULT: 0 verified / ${toVerify.length} attempted of ${discovered.length} discovered (none shown — integrity maintained)`,
        'warning'
      );
      setStatus(SearchStatus.COMPLETE);
      setResult({
        merchantName: discovery.merchantName,
        merchantUrl: discovery.merchantUrl,
        codes: [],
        unverifiedCount: discovered.length,
        competitors: discovery.competitors,
        verifierOnline: true,
        dominantFailureReason: timedOut ? 'page load timeout' : 'verifier error',
        stats: {
          sourcesScanned: discovered.length,
          codesDiscovered: discovered.length,
          codesTested: toVerify.length,
          codesVerified: 0,
          timeTaken: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
          moneySavedEstimate: '$0.00',
        },
      });
      return;
    }

    // ─── PHASE 3: STRICT FILTERING — VERIFIED ONLY ──────────────────────────
    // RULE: Only codes that PASSED real checkout simulation are shown.
    // Anything else is silently dropped. This is the core promise of the app.

    const allResults = verificationResponse.results || [];

    // Owner diagnostics only — codes + failure why in logs; NEVER in UI cards
    for (const r of allResults) {
      if (r.status === 'verified') continue;
      const err = (r.errorMessage || '').trim().slice(0, 100);
      addLog(
        `NOT VERIFIED [${r.code}]: status=${r.status}${err ? ` — ${err}` : ''}`,
        'info'
      );
    }

    const failureReason = dominantFailureReason(allResults);

    const verifiedCodes: CouponCode[] = allResults
      .filter(r => r.status === 'verified')
      .map(r => {
        const discCand = toVerify.find(c => c.code === r.code);
        return {
          code: r.code,
          description: r.codeDescription || discCand?.description || '',
          successRate: r.confidence,
          lastVerified: r.testedAt
            ? new Date(r.testedAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
            : 'Just now',
          source: r.source || 'AI Discovery',
          isVerified: true,
          status: 'verified' as const,
          testedRegion: r.testedRegion || (r as { testRegion?: string }).testRegion,
          testedAt: r.testedAt,
          discountText: r.discountText,
          discountAmount: r.discountAmount,
          responseTime: r.responseTime,
          likelyRegion: discCand?.likelyRegion,
          regionDisplay: discCand?.regionDisplay,
        };
      });

    // Unverified / untested candidates are NEVER mapped into UI payloads (verify-only invariant).
    // Counts only — no code strings returned for display.
    // With verify-all, untested only occurs if the batch budget/circuit stopped early.
    const untestedCount = Math.max(0, discovered.length - toVerify.length);

    const failedCount = allResults.filter(r =>
      r.status === 'failed' || r.status === 'expired' || r.status === 'error'
    ).length;

    const unverifiedCount = allResults.filter(r => r.status === 'unverified').length;

    // Log verification outcome
    addLog(
      `VERIFICATION COMPLETE: ${verifiedCodes.length}/${toVerify.length} CODES CONFIRMED AT CHECKOUT`,
      verifiedCodes.length > 0 ? 'success' : 'warning'
    );

    if (failedCount > 0) {
      addLog(`${failedCount} CODE${failedCount !== 1 ? 'S' : ''} REJECTED AT CHECKOUT`, 'info');
    }

    if (untestedCount > 0) {
      addLog(`${untestedCount} DISCOVERED CODE${untestedCount !== 1 ? 'S' : ''} NOT REACHED (batch budget / circuit)`, 'info');
    }

    // Estimated savings from actual discount amounts detected
    const savingsValues = verifiedCodes
      .map(c => {
        const match = (c.discountAmount || '').match(/[\d.]+/);
        return match ? parseFloat(match[0]) : 0;
      })
      .filter(v => v > 0);

    const estimatedSavings = savingsValues.length > 0
      ? `~$${savingsValues.reduce((a, b) => a + b, 0).toFixed(2)}`
      : verifiedCodes.length > 0
        ? '~savings detected'
        : '$0.00';

    setStatus(SearchStatus.COMPLETE);
    setResult({
      merchantName: discovery.merchantName,
      merchantUrl: discovery.merchantUrl,
      codes: verifiedCodes, // ONLY status === 'verified'
      unverifiedCount: failedCount + unverifiedCount + untestedCount,
      competitors: discovery.competitors,
      verifierOnline: true,
      dominantFailureReason: verifiedCodes.length === 0 ? failureReason : undefined,
      stats: {
        sourcesScanned: discovered.length,
        codesDiscovered: discovered.length,
        codesTested: verificationResponse.totalTested,
        codesVerified: verifiedCodes.length,
        timeTaken: verificationResponse.processingTimeMs
          ? `${(verificationResponse.processingTimeMs / 1000).toFixed(1)}s`
          : `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
        moneySavedEstimate: estimatedSavings,
      },
    });

    if (verifiedCodes.length > 0) {
      addLog(`✓ MISSION COMPLETE: ${verifiedCodes.length} VERIFIED CODE${verifiedCodes.length !== 1 ? 'S' : ''} READY`, 'success');
    } else {
      addLog(`MISSION COMPLETE: 0 verified / ${toVerify.length} tested — no fake codes returned`, 'warning');
    }

    // ─── PHASE 4: INTERNAL SIGNALS (non-blocking, never shown as codes) ─────
    // Social/influencer candidates stay internal — never passed to results UI.
    // Glitch warnings may surface (they do not contain copyable codes).
    setInfluencerCodes([]);
    if (discovery.merchantName) {
      findInfluencerCodes(discovery.merchantName).then(codes => {
        if (codes.length > 0) {
          // Log count only — do NOT setInfluencerCodes (verify-only invariant)
          addLog(`SOCIAL LAYER: ${codes.length} SIGNAL${codes.length !== 1 ? 'S' : ''} (INTERNAL ONLY — NOT SHOWN)`, 'info');
        }
      }).catch(() => {});

      checkGlitchProbability(discovery.merchantName).then(status => {
        setGlitchStatus(status);
        if (status.probability > 50) {
          addLog(`⚡ PRICE ANOMALY SIGNAL: ${status.probability}% PROBABILITY`, 'warning');
        }
      }).catch(() => {});
    }

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Search pipeline error:', errMsg);
    addLog(`CRITICAL PROTOCOL FAILURE: ${errMsg}`, 'error');
    setStatus(SearchStatus.ERROR);
  }
}