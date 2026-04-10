import { CouponCode, Competitor } from "../types";

const apiKey = import.meta.env.VITE_MINIMAX_API_KEY || '';
const baseUrl = import.meta.env.VITE_MINIMAX_API_URL || 'https://api.minimax.io/v1';

if (!apiKey) {
  console.warn('⚠️ VITE_MINIMAX_API_KEY not found. AI discovery will not work.');
}

const MODEL = 'MiniMax-M2.5';

interface DiscoveredCode {
  code: string;
  description: string;
  source: string;
  sourceUrl?: string;
  discoveredAt: string;
  discoveryConfidence: number;
}

interface DiscoveryResult {
  merchantName: string;
  merchantUrl: string;
  suggestedCodes: DiscoveredCode[];
  competitors: Competitor[];
  groundingUrls: string[];
}

async function callMinimax(prompt: string): Promise<string> {
  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY not configured');
  }

  const response = await fetch(`${baseUrl}/text/chatcompletion_v2`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`MiniMax API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function discoverCodes(query: string, region: string = 'US'): Promise<DiscoveryResult> {
  if (!apiKey) {
    console.warn('Cannot discover: API key not configured');
    return {
      merchantName: query,
      merchantUrl: `https://${query.replace(/\s/g, '').toLowerCase()}.com`,
      suggestedCodes: [],
      competitors: [],
      groundingUrls: [],
    };
  }

  const regionInstruction = region !== 'GLOBAL' && region
    ? `LOCATION CONSTRAINT: Prioritize codes valid in ${region}. Ignore codes strictly for other regions.`
    : 'LOCATION: Global search (default to US)';

  const prompt = `
You are a coupon discovery agent. Find working discount codes for: "${query}".
${regionInstruction}

MISSION:
1. Identify the merchant from the query
2. Search your knowledge for ACTIVE/PENDING discount codes
3. Only report codes from: official sites, Reddit, community forums, influencer posts
4. REJECT codes from: spam sites, placeholder codes (WELCOME, TEST), expired offers

OUTPUT: Return ONLY valid JSON (no markdown):
{
  "merchantName": "Store Name",
  "merchantUrl": "https://store.com",
  "suggestedCodes": [
    {
      "code": "CODE123",
      "description": "10% off or $20 discount",
      "source": "Reddit r/deals",
      "sourceUrl": "https://reddit.com/...",
      "discoveredAt": "2025-04-10",
      "discoveryConfidence": 45
    }
  ],
  "competitors": [
    {"name": "Competitor", "url": "url", "avgSavings": "15%"}
  ],
  "groundingUrls": ["https://source1.com", "https://source2.com"]
}

RULES:
- discoveryConfidence: 0-30 (single old source), 31-60 (community reports), 61-85 (multiple recent)
- Return 0 codes if none found - DO NOT HALLUCINATE
- Codes should be realistic for the merchant
`;

  try {
    const text = await callMinimax(prompt);
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.warn('Failed to parse MiniMax response, using fallback');
      parsed = {
        merchantName: query,
        merchantUrl: `https://${query.replace(/\s/g, '').toLowerCase()}.com`,
        suggestedCodes: [],
        competitors: [],
        groundingUrls: [],
      };
    }

    return {
      ...parsed,
      suggestedCodes: (parsed.suggestedCodes || []).map((c: DiscoveredCode) => ({
        ...c,
        discoveryConfidence: c.discoveryConfidence || 30,
        discoveredAt: c.discoveredAt || new Date().toISOString().split('T')[0],
      })),
    };
  } catch (error) {
    console.error('Discovery failed:', error);
    return {
      merchantName: query,
      merchantUrl: `https://${query.replace(/\s/g, '').toLowerCase()}.com`,
      suggestedCodes: [],
      competitors: [],
      groundingUrls: [],
    };
  }
}

export async function generateLogMessage(merchant: string, phase: 'scanning' | 'validating'): Promise<string> {
  if (!apiKey) {
    return phase === 'scanning'
      ? `Scanning ${merchant} network nodes...`
      : `Validating ${merchant} checkout simulation...`;
  }

  const prompt = phase === 'scanning'
    ? `Generate a technical log line about scanning ${merchant} for coupons. 30 chars max. Example: "Accessing shadow network nodes..."`
    : `Generate a technical log line about verifying a discount code at ${merchant} checkout. 30 chars max. Example: "Simulating checkout flow..."`;

  try {
    const text = await callMinimax(prompt);
    return text.trim().substring(0, 60);
  } catch {
    return `Processing ${merchant}...`;
  }
}

export async function findInfluencerCodes(merchantName: string): Promise<CouponCode[]> {
  if (!apiKey) return [];

  const prompt = `
Find ACTIVE influencer/promo codes for "${merchantName}".
Look for patterns like: [InfluencerName][discount], [Brand]@[handle], EVENT codes
Return JSON array: [{"code": "HANDLE25", "description": "25% off via influencer", "successRate": 70, "source": "Instagram @handle"}]
Return empty array if none found.
`;

  try {
    const text = await callMinimax(prompt);
    const match = text.match(/\[.*\]/s);
    if (!match) return [];
    const codes = JSON.parse(match[0]);
    return codes.map((c: any) => ({
      ...c,
      lastVerified: 'Social scan',
      isVerified: false,
    }));
  } catch {
    return [];
  }
}

export async function checkGlitchProbability(merchantName: string): Promise<{ probability: number; warning?: string }> {
  if (!apiKey) return { probability: 0 };

  const prompt = `
Analyze ${merchantName} for price glitch probability (0-100).
Known for glitches (Amazon, Walmart, airlines): 15-30%
Stable retailers: 0-5%
Return JSON: {"probability": number, "warning": "string or null"}
`;

  try {
    const text = await callMinimax(prompt);
    const match = text.match(/\{.*\}/s);
    if (!match) return { probability: 0 };
    return JSON.parse(match[0]);
  } catch {
    return { probability: 0 };
  }
}
