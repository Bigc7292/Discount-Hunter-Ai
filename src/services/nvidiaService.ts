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

  if (!API_KEY) {
    return EMPTY_RESULT;
  }

  const regionClause = region && region !== 'GLOBAL'
    ? `The user is in ${region}. Prioritize codes that work in ${region}. Exclude codes clearly restricted to other countries.`
    : 'Prioritise codes that work globally or in the US.';

  const systemPrompt = `You are a coupon discovery agent. Your ONLY job is to find REAL, ACTIVE discount codes for online stores.

CRITICAL RULES:
1. NEVER invent or guess codes. Only report codes you have genuine knowledge of.
2. If you are not confident a code exists, return an empty array for suggestedCodes.
3. Codes like "WELCOME10", "TEST", "DISCOUNT" without a known source are FORBIDDEN.
4. discoveryConfidence must be honest: 10-30 for old/uncertain, 31-60 for community reports, 61-80 for recently confirmed.
5. You MUST output valid JSON only. No markdown, no explanations, just the JSON object.`;

  const userPrompt = `Find REAL discount codes for: "${query}"
${regionClause}

Search your knowledge for codes from:
- Official store newsletters / social media
- Reddit (r/deals, r/coupons, r/frugal, store-specific subs)
- Community deal forums (SlickDeals, HotUKDeals, etc.)
- Influencer promo codes with known handles
- Seasonal/event sales codes (Black Friday, Back to School, etc.)

Return this exact JSON structure:
{
  "merchantName": "Exact Store Name",
  "merchantUrl": "https://store.com",
  "suggestedCodes": [
    {
      "code": "EXACTCODE",
      "description": "What this code does — e.g. 15% off sitewide, excludes sale items",
      "source": "Where you found it — e.g. Reddit r/Nike, Official newsletter",
      "sourceUrl": "https://direct-link-if-known.com",
      "discoveredAt": "YYYY-MM-DD or approximate month/year",
      "discoveryConfidence": 45
    }
  ],
  "competitors": [
    { "name": "Competitor Name", "url": "https://competitor.com", "avgSavings": "~15%" }
  ],
  "groundingUrls": ["https://source1.com"]
}

If no codes are found, return suggestedCodes as an empty array []. DO NOT HALLUCINATE.`;

  try {
    const raw = await callNvidia(systemPrompt, userPrompt);
    const parsed = safeParseJSON<DiscoveryResult>(raw, EMPTY_RESULT);

    return {
      merchantName: parsed.merchantName || query,
      merchantUrl: parsed.merchantUrl || EMPTY_RESULT.merchantUrl,
      suggestedCodes: (parsed.suggestedCodes || [])
        .filter(c => c.code && c.code.length >= 3 && c.code.length <= 30)
        .map(c => ({
          ...c,
          code: c.code.toUpperCase().trim(),
          discoveryConfidence: Math.min(80, Math.max(10, c.discoveryConfidence || 30)),
          discoveredAt: c.discoveredAt || new Date().toISOString().split('T')[0],
        }))
        .slice(0, 10), // Cap at 10 candidates max — prevents Puppeteer overload
      competitors: parsed.competitors || [],
      groundingUrls: parsed.groundingUrls || [],
    };

  } catch (error) {
    console.error('NVIDIA discovery failed:', error);
    return EMPTY_RESULT;
  }
}

// ---------------------------------------------------------------------------
// Influencer codes — social media promo codes (UNVERIFIED, display with disclaimer)
// ---------------------------------------------------------------------------

export async function findInfluencerCodes(merchantName: string): Promise<CouponCode[]> {
  if (!API_KEY) return [];

  const systemPrompt = `You are a social media coupon scanner. Find influencer promo codes only if you have genuine knowledge of them. Return empty array if uncertain. Output valid JSON only.`;

  const userPrompt = `Find ACTIVE influencer/creator promo codes for "${merchantName}".
Look for: [CreatorName][Brand], [Brand][Creator], partnership codes.
Return JSON array (empty [] if none found):
[{"code":"HANDLE25","description":"25% off via influencer partnership","successRate":55,"source":"YouTube @channelname"}]`;

  try {
    const raw = await callNvidia(systemPrompt, userPrompt);
    const codes = safeParseJSON<any[]>(raw, []);

    if (!Array.isArray(codes)) return [];

    return codes
      .filter(c => c.code && typeof c.code === 'string')
      .map(c => ({
        code: (c.code as string).toUpperCase().trim(),
        description: c.description || 'Influencer promo code',
        successRate: Math.min(70, Math.max(10, c.successRate || 40)),
        lastVerified: 'Social scan — NOT checkout verified',
        source: c.source || 'Social media',
        isVerified: false,
        status: 'unverified' as const,
      }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Glitch probability — price anomaly detection
// ---------------------------------------------------------------------------

export async function checkGlitchProbability(
  merchantName: string
): Promise<{ probability: number; warning?: string }> {
  if (!API_KEY) return { probability: 0 };

  const systemPrompt = `You are a retail pricing analyst. Assess price glitch probability based on known retailer patterns. Output valid JSON only.`;

  const userPrompt = `Assess price glitch probability (0-100) for "${merchantName}".
Known high-glitch retailers (Amazon, Walmart, airline booking): 15-30%
Stable direct-to-consumer brands: 1-5%
Return JSON: {"probability": number, "warning": "string or null"}`;

  try {
    const raw = await callNvidia(systemPrompt, userPrompt);
    const result = safeParseJSON<{ probability: number; warning?: string }>(
      raw,
      { probability: 0 }
    );
    return {
      probability: Math.min(100, Math.max(0, result.probability || 0)),
      warning: result.warning || undefined,
    };
  } catch {
    return { probability: 0 };
  }
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
