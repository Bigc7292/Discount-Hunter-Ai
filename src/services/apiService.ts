/**
 * API Service — Frontend → Backend Verifier Communication
 * Handles health checks and verification requests to the Node/Puppeteer backend.
 */

import type { CodeStatus } from '../types';

const API_BASE_URL =
  import.meta.env.VITE_VERIFIER_API_URL ||
  (import.meta.env.PROD
    ? 'https://discount-hunter-backend-oz8e.onrender.com'
    : 'http://localhost:3001');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VerifyCode {
  code: string;
  description: string;
  source?: string;
  sourceUrl?: string;
}

export interface Merchant {
  name: string;
  url: string;
}

export interface VerifyRequest {
  merchant: Merchant;
  codes: VerifyCode[];
  testRegion: string;
}

export interface CodeVerificationResult {
  code: string;
  status: CodeStatus;
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

export interface VerificationResponse {
  merchant: { name: string; url: string; region: string };
  results: CodeVerificationResult[];
  totalTested: number;
  successful: number;
  failed: number;
  unverified: number;
  processingTimeMs: number;
}

// ---------------------------------------------------------------------------
// Health check — always call this BEFORE starting a search
// ---------------------------------------------------------------------------

export async function checkVerifierHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout for health check

    const response = await fetch(`${API_BASE_URL}/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Verify codes — sends candidates to the Puppeteer backend for real testing
// ---------------------------------------------------------------------------

export async function verifyCodes(
  merchant: Merchant,
  codes: VerifyCode[],
  testRegion: string
): Promise<VerificationResponse | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000); // 2 min

    const response = await fetch(`${API_BASE_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant: {
          name: merchant.name,
          url: merchant.url,
          region: testRegion,
        },
        codes: codes.map(c => ({
          code: c.code,
          description: c.description,
          source: c.source || 'Unknown',
          sourceUrl: c.sourceUrl,
        })),
        testRegion,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`Verifier error: HTTP ${response.status}`);
      return null;
    }

    return await response.json() as VerificationResponse;

  } catch (error) {
    console.error('Verifier service error:', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Get supported regions from backend
// ---------------------------------------------------------------------------

export async function getSupportedRegions(): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${API_BASE_URL}/regions`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!response.ok) return [];
    const data = await response.json();
    return data.regions || data.map?.((r: { code: string }) => r.code) || [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Discover codes — calls the Express backend's multi-source discovery pipeline
// ---------------------------------------------------------------------------

export interface DiscoveredCode {
  code: string;
  description: string;
  source: string;
  sourceUrl?: string;
  discoveredAt: string;
  discoveryConfidence: number;
  likelyRegion?: string;
  regionDisplay?: string;
}

export interface DiscoveryResponse {
  merchantName: string;
  merchantUrl: string;
  suggestedCodes: DiscoveredCode[];
  competitors: any[];
  groundingUrls: string[];
  meta?: {
    sourcesSearched: string[];
    totalTextsAnalysed: number;
    discoveryDurationMs: number;
  };
}

export async function discoverCodes(
  query: string,
  region: string
): Promise<DiscoveryResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000); // 60s timeout for backend discovery

  try {
    const response = await fetch(`${API_BASE_URL}/discover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, region }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Discovery backend error: HTTP ${response.status}`);
    }

    return await response.json() as DiscoveryResponse;
  } catch (error) {
    clearTimeout(timeout);
    console.error('Discovery service error:', error);
    throw error;
  }
}


// ---------------------------------------------------------------------------
// Stripe checkout — yearly (subscription) or lifetime (one-time), TEST MODE
// ---------------------------------------------------------------------------

export type StripeCheckoutPlan = 'yearly' | 'lifetime';

export async function createCheckoutSession(
  idToken: string,
  plan: StripeCheckoutPlan = 'lifetime',
): Promise<{ url: string; plan: StripeCheckoutPlan }> {
  const response = await fetch(`${API_BASE_URL}/stripe/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ plan }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Checkout session failed: HTTP ${response.status}`);
  }

  return await response.json() as { url: string; plan: StripeCheckoutPlan };
}

/** @deprecated Prefer createCheckoutSession(idToken, 'lifetime') */
export async function createLifetimeCheckoutSession(idToken: string): Promise<{ url: string }> {
  return createCheckoutSession(idToken, 'lifetime');
}

// ---------------------------------------------------------------------------
// Public verified-checkout ledger (redacted codes only)
// ---------------------------------------------------------------------------

export interface CheckoutLedgerEntry {
  id: string;
  merchant: string;
  merchantUrl?: string;
  cartSummary: string;
  result: 'pass' | 'fail' | 'error' | 'expired';
  testedAt: string;
  region: string;
  confidence?: number;
  codeLast4: string;
  codeHash: string;
}

export interface CheckoutLedgerResponse {
  entries: CheckoutLedgerEntry[];
  total: number;
  limit: number;
  offset: number;
  source: 'firestore' | 'memory';
}

export async function fetchCheckoutLedger(
  limit: number = 50,
  offset: number = 0
): Promise<CheckoutLedgerResponse | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(
      `${API_BASE_URL}/ledger?limit=${encodeURIComponent(String(limit))}&offset=${encodeURIComponent(String(offset))}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!response.ok) {
      console.error(`Ledger error: HTTP ${response.status}`);
      return null;
    }
    return await response.json() as CheckoutLedgerResponse;
  } catch (error) {
    console.error('Ledger service error:', error);
    return null;
  }
}

