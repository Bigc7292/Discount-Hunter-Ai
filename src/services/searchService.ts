/**
 * Search Service — Core Pipeline Orchestrator
 *
 * Pipeline: Health Check → Discovery (NVIDIA AI) → Verification (Backend/Puppeteer) → Display
 *
 * STRICT RULES:
 * 1. If the verifier backend is offline → HARD STOP. Zero codes shown. Never fallback.
 * 2. Only codes with status === 'verified' (confirmed at real checkout) are returned.
 * 3. Discovery codes that fail or are unverified are SILENTLY DROPPED — never shown.
 */

import { CouponCode, SearchResult, SearchStatus, LogEntry } from '../types';
import { discoverCodes, findInfluencerCodes, checkGlitchProbability, generateLogMessage } from './nvidiaService';
import { checkVerifierHealth } from './apiService';

// Maximum candidates to send to verifier (prevents overloading Puppeteer)
const MAX_CODES_TO_VERIFY = 10;

// Verifier timeout: if backend takes longer than this, abort (ms)
const VERIFIER_TIMEOUT_MS = 120_000; // 2 minutes

const VERIFIER_URL = import.meta.env.VITE_VERIFIER_API_URL || 'http://localhost:3001';

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

async function runVerification(
  merchantName: string,
  merchantUrl: string,
  codes: { code: string; description: string; source?: string; sourceUrl?: string }[],
  region: string
): Promise<VerificationResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERIFIER_TIMEOUT_MS);

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

    const toVerify = discovered.slice(0, MAX_CODES_TO_VERIFY);
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
      // Verifier went offline mid-search or timed out
      const errMsg = verifyError instanceof Error ? verifyError.message : 'Unknown error';
      addLog(`⛔ VERIFICATION FAILED: ${errMsg}`, 'error');
      addLog('MISSION ABORTED — No codes returned. Integrity maintained.', 'error');
      setStatus(SearchStatus.ERROR);
      setResult({
        merchantName: discovery.merchantName,
        merchantUrl: discovery.merchantUrl,
        codes: [],
        unverifiedCount: discovered.length,
        competitors: discovery.competitors,
        verifierOnline: false,
        stats: {
          sourcesScanned: discovered.length,
          codesDiscovered: discovered.length,
          codesTested: 0,
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
    const verifiedCodes: CouponCode[] = allResults
      .filter(r => r.status === 'verified')
      .map(r => ({
        code: r.code,
        description: r.codeDescription || toVerify.find(c => c.code === r.code)?.description || '',
        successRate: r.confidence,
        lastVerified: r.testedAt
          ? new Date(r.testedAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
          : 'Just now',
        source: r.source || 'AI Discovery',
        isVerified: true,
        status: 'verified' as const,
        testedRegion: r.testedRegion,
        testedAt: r.testedAt,
        discountText: r.discountText,
        discountAmount: r.discountAmount,
        responseTime: r.responseTime,
      }));

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
      addLog(`${failedCount} CODE${failedCount !== 1 ? 'S' : ''} REJECTED AT CHECKOUT — NOT SHOWN`, 'info');
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
      codes: verifiedCodes,
      unverifiedCount: failedCount + unverifiedCount,
      competitors: discovery.competitors,
      verifierOnline: true,
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
      addLog('MISSION COMPLETE: 0 codes survived checkout testing — no fake codes returned', 'warning');
    }

    // ─── PHASE 4: SOCIAL LAYER (additive, non-blocking) ─────────────────────
    // Influencer codes and glitch detection run in background.
    // These are SUPPLEMENTARY and clearly labelled as unverified in the UI.
    if (discovery.merchantName) {
      findInfluencerCodes(discovery.merchantName).then(codes => {
        if (codes.length > 0) {
          setInfluencerCodes(codes);
          addLog(`SOCIAL LAYER: ${codes.length} INFLUENCER CODE${codes.length !== 1 ? 'S' : ''} DETECTED (UNVERIFIED)`, 'info');
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
