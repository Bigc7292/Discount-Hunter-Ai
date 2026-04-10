import { CouponCode, Competitor } from "../types";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

if (!apiKey) {
  console.warn('⚠️ VITE_GEMINI_API_KEY not found. Gemini AI features will not work.');
}

const modelName = "gemini-3-pro-preview";

interface DiscoveredCode {
  code: string;
  description: string;
  source: string;
  sourceUrl?: string;
  discoveredAt: string;
  discoveryConfidence: number;
}

interface SearchResponse {
  merchantName: string;
  merchantUrl: string;
  suggestedCodes: DiscoveredCode[];
  competitors: Competitor[];
  groundingUrls?: string[];
}

interface PlanSearchResult {
  merchantName: string;
  merchantUrl: string;
  suggestedCodes: Array<{
    code: string;
    description: string;
    source: string;
    likelySuccessRate: number;
  }>;
  competitors: Competitor[];
  groundingUrls?: string[];
}

let aiInstance: any = null;

async function getAI() {
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY is not configured');
  }

  if (!aiInstance) {
    const { GoogleGenAI } = await import("@google/genai");
    aiInstance = new GoogleGenAI({ apiKey });
  }

  return aiInstance;
}

function estimateDiscoveryConfidence(code: DiscoveredCode, sourceAge?: string): number {
  let confidence = 30;

  const recentSources = ['reddit', 'twitter', 'x.com', 'instagram', 'tiktok', 'facebook'];
  if (recentSources.some(s => code.source.toLowerCase().includes(s))) {
    confidence += 25;
  }

  const officialSources = ['official', 'newsletter', 'email', '官网', 'site'];
  if (officialSources.some(s => code.source.toLowerCase().includes(s))) {
    confidence += 30;
  }

  const spamSources = ['coupon', 'deals', 'promo', 'discount'];
  if (spamSources.some(s => code.source.toLowerCase().includes(s))) {
    confidence -= 10;
  }

  if (code.description.toLowerCase().includes('verified') || 
      code.description.toLowerCase().includes('confirmed')) {
    confidence += 15;
  }

  return Math.max(15, Math.min(85, confidence));
}

export const planSearch = async (query: string, region: string = 'GLOBAL'): Promise<PlanSearchResult> => {
  if (!apiKey) {
    return {
      merchantName: query,
      merchantUrl: `https://${query.replace(/\s/g, '').toLowerCase()}.com`,
      suggestedCodes: [],
      competitors: [],
      groundingUrls: []
    };
  }

  const regionConstraint = region !== 'GLOBAL'
    ? `CRITICAL LOCATION REQUIREMENT: The user is in ${region}. Find codes specifically valid for ${region}. For UAE use .ae domains/Emirates sources. For UK use .co.uk/UK-specific sources.`
    : 'Location: Global search.';

  const prompt = `
    User is searching for discount codes for: "${query}".
    ${regionConstraint}
    
    MISSION: Discover valid discount codes through real source verification.
    
    PHASE 1: MERCHANT IDENTIFICATION
    - Identify the official merchant name and website
    - Determine the merchant's primary region and where they offer discounts
    
    PHASE 2: DISCOVERY (NOT verification - just finding candidates)
    Search for codes from these sources:
    1. Official merchant pages and newsletters
    2. Reddit (r/frugal, r/deals, merchant-specific subs)
    3. Twitter/X posts from official accounts or deal finders
    4. Deal aggregators (Slickdeals, HotDeal, etc.)
    5. Influencer social media posts
    
    PHASE 3: SOURCE EVALUATION
    For each code found, assess:
    - Source reliability (official > community > aggregator)
    - Recency of reports
    - Geographic validity
    - Any restrictions or minimums
    
    OUTPUT FORMAT (STRICT JSON):
    {
      "merchantName": "Store Name",
      "merchantUrl": "https://store.com",
      "suggestedCodes": [
        { 
          "code": "CODE123", 
          "description": "10% off your order", 
          "source": "Reddit r/frugal (2 hours ago)", 
          "sourceUrl": "https://reddit.com/...",
          "discoveredAt": "2025-01-01",
          "discoveryConfidence": 65
        }
      ],
      "competitors": [
        { "name": "Competitor", "url": "url", "avgSavings": "15%" }
      ]
    }
    
    IMPORTANT:
    - Return ONLY codes you found from real sources
    - Set discoveryConfidence based on source reliability (0-100)
    - Do NOT guess or hallucinate codes
    - If no codes found, return empty suggestedCodes array
    - Focus on codes with recent (within 7 days) reports
  `;

  try {
    const geminiAI = await getAI();
    let response;
    let foundUrls: string[] = [];

    try {
      response = await geminiAI.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinkingBudget: 16384 }
        }
      });

      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      foundUrls = groundingChunks
        .map((c: any) => c.web?.uri)
        .filter((uri: string) => uri);

    } catch (e: any) {
      console.warn("Search with grounding failed, using fallback:", e.message);
      
      response = await geminiAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
    }

    let text = response.text || "{}";
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    let parsedData: SearchResponse;
    try {
      parsedData = JSON.parse(text);
    } catch (e) {
      console.warn("JSON parse failed:", e);
      parsedData = {
        merchantName: query,
        merchantUrl: `https://${query.replace(/\s/g, '').toLowerCase()}.com`,
        suggestedCodes: [],
        competitors: []
      };
    }

    const suggestedCodes = (parsedData.suggestedCodes || []).map((code: DiscoveredCode) => ({
      code: code.code,
      description: code.description,
      source: code.source,
      likelySuccessRate: estimateDiscoveryConfidence(code)
    }));

    return {
      merchantName: parsedData.merchantName || query,
      merchantUrl: parsedData.merchantUrl || `https://${query.replace(/\s/g, '').toLowerCase()}.com`,
      suggestedCodes,
      competitors: parsedData.competitors || [],
      groundingUrls: foundUrls
    };

  } catch (error) {
    console.error("Gemini Planning Critical Failure:", error);
    return {
      merchantName: query,
      merchantUrl: `https://${query.replace(/\s/g, '').toLowerCase()}.com`,
      suggestedCodes: [],
      competitors: [],
      groundingUrls: []
    };
  }
};

export const generateLogMessage = async (merchant: string, phase: 'scanning' | 'validating') => {
  if (!apiKey) {
    return phase === 'scanning'
      ? `Scanning ${merchant} database nodes...`
      : `Validating ${merchant} checkout flow...`;
  }

  try {
    const geminiAI = await getAI();
    const prompt = phase === 'scanning'
      ? `Generate a technical log line about discovering discount codes for ${merchant}.`
      : `Generate a log line about verifying a discount code at ${merchant}.`;

    const response = await geminiAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { maxOutputTokens: 30 }
    });
    return response.text?.trim() || `Processing ${merchant}...`;
  } catch (e) {
    return `Analyzing ${merchant} nodes...`;
  }
};

export const generateNegotiationScript = async (merchant: string, strategy: string): Promise<string> => {
  if (!apiKey) return "Error: API connection lost.";

  try {
    const geminiAI = await getAI();
    const prompt = `
      ACT AS: A pricing negotiation expert.
      GOAL: Write a short, persuasive message for ${merchant} customer support.
      STRATEGY: ${strategy}
      
      RULES:
      1. Be polite but firm
      2. Sound human
      3. Keep under 280 characters
      4. Just output the direct message text
    `;

    const response = await geminiAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text?.trim() || "Hi! I'm interested in your products. Do you have any current discounts?";
  } catch (error) {
    return "Hi! I'm interested in your products. Do you have any current discounts?";
  }
};

export async function findInfluencerCodes(merchantName: string): Promise<CouponCode[]> {
  if (!apiKey) return [];

  try {
    const geminiAI = await getAI();
    const prompt = `
      Act as a social media code finder for ${merchantName}.
      Find influencer codes from Instagram, TikTok, Twitter.
      
      Return JSON array: [{ "code": "HANDLE20", "description": "20% off", "source": "Instagram @handle", "successRate": 70 }]
      Return empty array if none found.
    `;

    const result = await geminiAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });

    const responseText = result.text?.() || "[]";
    const jsonMatch = responseText.match(/\[.*\]/s);

    if (!jsonMatch) return [];

    const codes = JSON.parse(jsonMatch[0]);
    return codes.map((c: any) => ({
      code: c.code,
      description: c.description,
      successRate: c.successRate || 50,
      lastVerified: 'Recently found',
      source: c.source || 'Social Media',
      isVerified: false,
      status: 'unverified' as const
    }));

  } catch (error) {
    return [];
  }
}

export async function checkGlitchProbability(merchantName: string): Promise<{ probability: number, warning?: string }> {
  if (!apiKey) return { probability: 0 };

  try {
    const geminiAI = await getAI();
    const prompt = `
      Check for price glitches or errors for ${merchantName}.
      Return JSON: { "probability": 0-100, "warning": "message or null" }
    `;

    const result = await geminiAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });

    const responseText = result.text?.() || "{}";
    const jsonMatch = responseText.match(/\{.*\}/s);

    if (!jsonMatch) return { probability: 0 };

    return JSON.parse(jsonMatch[0]);

  } catch (error) {
    return { probability: 0 };
  }
}
