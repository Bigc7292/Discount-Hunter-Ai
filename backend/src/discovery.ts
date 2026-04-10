const API_KEY = process.env.MINIMAX_API_KEY || process.env.VITE_MINIMAX_API_KEY || '';
const BASE_URL = process.env.MINIMAX_API_URL || 'https://api.minimax.io/v1';
const MODEL = 'MiniMax-M2.5';

interface DiscoveredCode {
  code: string;
  description: string;
  source: string;
  sourceUrl?: string;
  discoveredAt: string;
  discoveryConfidence: number;
}

interface Competitor {
  name: string;
  url: string;
  avgSavings: string;
}

interface DiscoveryResult {
  merchantName: string;
  merchantUrl: string;
  suggestedCodes: DiscoveredCode[];
  competitors: Competitor[];
  groundingUrls: string[];
}

async function chat(messages: { role: string; content: string }[]): Promise<string> {
  if (!API_KEY) {
    throw new Error('MINIMAX_API_KEY not configured');
  }

  const response = await fetch(`${BASE_URL}/text/chatcompletion_v2`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`MiniMax API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function discoverCodes(query: string, region: string = 'GLOBAL'): Promise<DiscoveryResult> {
  const regionContext = region !== 'GLOBAL'
    ? `User is in ${region}. Prioritize codes valid in that region (e.g., .ae for UAE/ Dubai, .co.uk for UK, .de for Germany).`
    : 'Global/international search.';

  const systemPrompt = `You are a discount code discovery agent. Your job is to find REAL, WORKING discount codes for online stores.

STRICT RULES:
- Only return codes found from real sources (forums like Reddit, official brand pages, verified community posts, coupon aggregation sites)
- Do NOT invent or hallucinate codes
- If no working codes exist, return an empty list
- For each code, include the source where it was found
- Prioritize recent codes (within last 30 days)
- Each code MUST have a discoveryConfidence between 0-100 based on source reliability

${regionContext}

OUTPUT FORMAT - Return ONLY valid JSON (no markdown):
{
  "merchantName": "Store Name",
  "merchantUrl": "https://store.com",
  "suggestedCodes": [
    {
      "code": "REALCODE",
      "description": "10% off first order",
      "source": "Reddit r/deals",
      "sourceUrl": "https://reddit.com/...",
      "discoveredAt": "2026-04-01",
      "discoveryConfidence": 75
    }
  ],
  "competitors": [
    {"name": "Competitor Store", "url": "https://competitor.com", "avgSavings": "15%"}
  ]
}`;

  try {
    const result = await chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Find working discount codes for: ${query}` },
    ]);

    let cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const parsed = JSON.parse(cleaned);
    
    return {
      merchantName: parsed.merchantName || query,
      merchantUrl: parsed.merchantUrl || `https://${query.replace(/\s/g, '').toLowerCase()}.com`,
      suggestedCodes: (parsed.suggestedCodes || []).map((c: any) => ({
        ...c,
        discoveredAt: c.discoveredAt || new Date().toISOString().split('T')[0],
        discoveryConfidence: c.discoveryConfidence || 50,
      })),
      competitors: parsed.competitors || [],
      groundingUrls: (parsed.suggestedCodes || [])
        .map((c: any) => c.sourceUrl)
        .filter(Boolean),
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
