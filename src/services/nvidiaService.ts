/**
 * NVIDIA NIM Service — AI Discovery Layer
 *
 * Uses: meta/llama-3.3-70b-instruct via NVIDIA NIM API
 * Base URL: https://integrate.api.nvidia.com/v1
 * Free tier: build.nvidia.com (no credit card required)
 * OpenAI-compatible interface — minimal migration cost from MiniMax.
 *
 * This service is DISCOVERY ONLY. It finds candidate codes.
 * Verification (real checkout testing) is done by the backend verifier.
 */

import { CouponCode, Competitor } from '../types';

const API_BASE_URL = import.meta.env.VITE_VERIFIER_API_URL || 'http://localhost:3001';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_KEY = import.meta.env.VITE_NVIDIA_API_KEY || '';
const BASE_URL = 'https://integrate.api.nvidia.com/v1';
const MODEL = 'meta/llama-3.3-70b-instruct';
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

if (!API_KEY) {
  console.warn(
    '⚠️  VITE_NVIDIA_API_KEY is not set. AI discovery will not work.\n' +
    '   Get a free key at: https://build.nvidia.com'
  );
}

async function callDiscoveryBackend(payload: { query: string; region: string }) {
  const response = await fetch(`${API_BASE_URL}/discover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Discovery backend error: ${response.status}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DiscoveredCode {
  code: string;
  description: string;
  source: string;
  sourceUrl?: string;
  discoveredAt: string;
  discoveryConfidence: number;
}

export interface DiscoveryResult {
  merchantName: string;
  merchantUrl: string;
  suggestedCodes: DiscoveredCode[];
  competitors: Competitor[];
  groundingUrls: string[];
}

// ---------------------------------------------------------------------------
// Core API call — with retry and JSON enforcement
// ---------------------------------------------------------------------------

async function callNvidia(
  systemPrompt: string,
  userPrompt: string,
  attempt: number = 0
): Promise<string> {
  if (!API_KEY) {
    throw new Error('NVIDIA API key not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,         // Low temperature = more deterministic, less hallucination
        max_tokens: 2048,
        response_format: { type: 'json_object' }, // Enforces valid JSON output
        top_p: 0.7,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`NVIDIA API ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    if (!content) {
      throw new Error('Empty response from NVIDIA API');
    }

    return content;

  } catch (error) {
    clearTimeout(timeout);

    // Retry on transient errors (rate limits, timeouts, 5xx)
    if (attempt < MAX_RETRIES) {
      const isRetryable =
        error instanceof Error && (
          error.name === 'AbortError' ||
          error.message.includes('429') ||
          error.message.includes('5')
        );

      if (isRetryable) {
        console.warn(`NVIDIA API attempt ${attempt + 1} failed, retrying in ${RETRY_DELAY_MS}ms...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
        return callNvidia(systemPrompt, userPrompt, attempt + 1);
      }
    }

    throw error;
  }
}

// ---------------------------------------------------------------------------
// Safe JSON parse — never crashes the pipeline
// ---------------------------------------------------------------------------

function safeParseJSON<T>(text: string, fallback: T): T {
  try {
    // Strip any markdown code fences that might slip through
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    console.warn('JSON parse failed. Raw response:', text.substring(0, 200));
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Discovery — find candidate discount codes for a merchant
// ---------------------------------------------------------------------------

export async function discoverCodes(
  query: string,
  region: string = 'US'
): Promise<DiscoveryResult> {
  const EMPTY_RESULT: DiscoveryResult = {
    merchantName: query,
    merchantUrl: `https://${query.replace(/\s+/g, '').toLowerCase()}.com`,
    suggestedCodes: [],
    competitors: [],
    groundingUrls: [],
  };

  try {
    const response = await callDiscoveryBackend({ query, region });

    return {
      merchantName: response.merchantName || query,
      merchantUrl: response.merchantUrl || EMPTY_RESULT.merchantUrl,
      suggestedCodes: (response.suggestedCodes || [])
        .filter((c: any) => c.code && c.code.length >= 3 && c.code.length <= 30)
        .map((c: any) => ({
          ...c,
          code: c.code.toUpperCase().trim(),
          discoveryConfidence: Math.min(80, Math.max(10, c.discoveryConfidence || 30)),
          discoveredAt: c.discoveredAt || new Date().toISOString().split('T')[0],
        }))
        .slice(0, 10),
      competitors: response.competitors || [],
      groundingUrls: response.groundingUrls || [],
    };
  } catch (error) {
    console.warn('Discovery backend unavailable, returning empty result:', error);
    return EMPTY_RESULT;
  }
}

// ---------------------------------------------------------------------------
// Influencer codes — social media promo codes (UNVERIFIED, display with disclaimer)
// ---------------------------------------------------------------------------

export async function findInfluencerCodes(merchantName: string): Promise<CouponCode[]> {
  return [];
}

// ---------------------------------------------------------------------------
// Glitch probability — price anomaly detection
// ---------------------------------------------------------------------------

export async function checkGlitchProbability(
  merchantName: string
): Promise<{ probability: number; warning?: string }> {
  return { probability: 0 };
}

// ---------------------------------------------------------------------------
// Log message generator — UI flavour text
// ---------------------------------------------------------------------------

export async function generateLogMessage(
  merchant: string,
  phase: 'scanning' | 'validating'
): Promise<string> {
  // Static fallbacks — no API call needed for log messages (save rate limits)
  const scanMessages = [
    `Scanning ${merchant} deal networks...`,
    `Accessing ${merchant} coupon databases...`,
    `Sweeping ${merchant} community forums...`,
    `Probing ${merchant} discount channels...`,
  ];
  const validateMessages = [
    `Launching headless browser for ${merchant}...`,
    `Simulating ${merchant} checkout flow...`,
    `Testing code against ${merchant} cart...`,
    `Verifying discount at ${merchant} payment page...`,
  ];

  const pool = phase === 'scanning' ? scanMessages : validateMessages;
  return pool[Math.floor(Math.random() * pool.length)];
}
