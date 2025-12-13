import { CouponCode, Competitor } from "../types";

// IMPORTANT: In Vite, environment variables must be prefixed with VITE_ and accessed via import.meta.env
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

if (!apiKey) {
  console.warn('⚠️ VITE_GEMINI_API_KEY not found. Gemini AI features will not work. Please add it to your .env file or Vercel environment variables.');
}

// CHANGED: Upgraded to Gemini 3.0 Pro for Thinking capabilities
const modelName = "gemini-3-pro-preview";

interface SearchResponse {
  merchantName: string;
  merchantUrl: string;
  suggestedCodes: {
    code: string;
    description: string;
    source: string;
    likelySuccessRate: number;
  }[];
  competitors: {
    name: string;
    url: string;
    avgSavings: string;
  }[];
  groundingUrls?: string[];
}

// Dynamic import wrapper - only loads Google GenAI library when actually needed
// This prevents the library from crashing on import when API key is missing
let aiInstance: any = null;

async function getAI() {
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY is not configured. Please add it to your environment variables.');
  }

  if (!aiInstance) {
    // Dynamic import - only loads when this function is called
    const { GoogleGenAI } = await import("@google/genai");
    aiInstance = new GoogleGenAI({ apiKey });
  }

  return aiInstance;
}

/**
 * uses Gemini 3.0 Pro with Deep Thinking to find and STRICTLY VALIDATE codes.
 * Includes a fallback to standard generation if Search is restricted (403).
 */
export const planSearch = async (query: string, region: string = 'GLOBAL'): Promise<SearchResponse> => {

  // If no API key, return empty results immediately without trying to load the library
  if (!apiKey) {
    console.warn('Cannot search: VITE_GEMINI_API_KEY is not configured');
    return {
      merchantName: query,
      merchantUrl: `https://${query.replace(/\s/g, '').toLowerCase()}.com`,
      suggestedCodes: [],
      competitors: [],
      groundingUrls: []
    };
  }

  const regionInstruction = region !== 'GLOBAL'
    ? `LOCATION CONSTRAINT: The user is located in ${region}. You MUST prioritize codes valid in ${region} (e.g., .ae for UAE, .co.uk for UK). Ignore codes that are strictly valid only in other regions.`
    : `LOCATION: Global/International search.`;

  // UPGRADED PROMPT: STRICT VERIFICATION PROTOCOL
  const prompt = `
      User is searching for discount codes for: "${query}".
      ${regionInstruction}
      
      *** DEADLY IMPORTANT: STRICT VERIFICATION PROTOCOL ***
      
      Your goal is NOT just to find text that looks like a code. Your goal is VALIDATION.
      You must act as an Autonomous Agent performing a "Virtual Checkout Simulation".
      
      PHASE 1: SEARCH & DISCOVERY
      1. ACCESS the Google Search Index immediately.
      2. SEARCH for official merchant pages, social media (Twitter/X), and real-time community threads (Reddit, Slickdeals).
      
      PHASE 2: VIRTUAL AI ENVIRONMENT SIMULATION (THINKING MODE)
      For every potential code you find, you must mentally simulate the following "Physical Verification" steps:
      1.  **Navigate**: Conceptually visit the merchant's checkout page for the specific region.
      2.  **Cart Simulation**: Imagine adding a relevant high-value item (e.g., if searching "Emirates", simulate booking a Flight to Dubai).
      3.  **Input Test**: Simulate entering the code into the promo field.
      4.  **Constraint Check**: Check terms (Expiry, New Customer Only, Minimum Spend).
      
      STRICT RULES:
      - If a code is found on a spammy coupon site but not verified by a human on a forum/social media in the last 24 hours: REJECT IT.
      - If the code looks like a placeholder (e.g., "DEAL50" with no success reports): REJECT IT.
      - It is better to return ZERO codes than ONE fake code.
      
      OUTPUT FORMAT:
      Return a STRICT JSON string (no markdown formatting, no backticks) with this structure:
      {
        "merchantName": "Store Name",
        "merchantUrl": "https://store.com",
        "estimatedTotalSavings": "$25.00",
        "suggestedCodes": [
           { "code": "CODE1", "description": "10% off", "source": "Reddit/Verified", "likelySuccessRate": 95, "estimatedSavings": "$15.00" },
           ...
        ],
        "competitors": [
           { "name": "Comp1", "url": "url", "avgSavings": "15%" },
           ...
        ]
      }
      
      IMPORTANT: For estimatedSavings, calculate a realistic dollar/currency amount based on typical order values for that merchant. For example:
      - "10% off" at Nike with avg order $150 = "$15.00"
      - "$20 off $100+" = "$20.00"
      - "Free shipping" = "$8.00" (typical shipping cost)
      `;


  try {
    const geminiAI = await getAI(); // Get AI instance (will throw if no API key)
    let response;
    let foundUrls: string[] = [];

    // ATTEMPT 1: Try with Google Search Grounding + Thinking
    try {
      response = await geminiAI.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          // CRITICAL: Thinking Budget set to Max (32k) for deep verification simulation
          thinkingConfig: { thinkingBudget: 32768 }
        }
      });

      // Extract Grounding Metadata (Real URLs found)
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      foundUrls = groundingChunks
        .map((c: any) => c.web?.uri)
        .filter((uri: string) => uri); // Filter undefined

    } catch (e: any) {
      // Catch Permission Denied (403) or other tool-related errors
      console.warn("Search Grounding/Thinking failed (falling back to standard):", e.message);

      // ATTEMPT 2: Fallback to standard internal knowledge (Flash) if Pro fails
      response = await geminiAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
    }

    // Clean up response text to ensure it's valid JSON
    let text = response.text || "{}";
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    // Parse the JSON
    let parsedData;
    try {
      parsedData = JSON.parse(text);
    } catch (e) {
      console.warn("JSON Parse failed, attempting fallback repair", e);
      parsedData = {
        merchantName: query,
        merchantUrl: "",
        suggestedCodes: [],
        competitors: []
      };
    }

    return {
      ...parsedData,
      groundingUrls: foundUrls // Attach real sources if Attempt 1 succeeded
    };

  } catch (error) {
    console.error("Gemini Planning Critical Failure:", error);
    // Ultimate fallback to prevent app crash
    return {
      merchantName: query,
      merchantUrl: `https://${query.replace(/\s/g, '').toLowerCase()}.com`,
      suggestedCodes: [],
      competitors: [],
      groundingUrls: []
    };
  }
};

/**
 * Generates a realistic "Log" entry.
 */
export const generateLogMessage = async (merchant: string, phase: 'scanning' | 'validating') => {
  // If no API key, return a fallback message immediately
  if (!apiKey) {
    return phase === 'scanning'
      ? `Scanning ${merchant} database nodes...`
      : `Validating ${merchant} checkout flow...`;
  }

  try {
    const prompt = phase === 'scanning'
      ? `Generate a highly technical log line about an autonomous agent searching for ${merchant} coupons. Mention "Virtual Environment" or "Search Index".`
      : `Generate a log line about strictly validating a code on ${merchant} by simulating a checkout. Example: "Simulating cart checkout...", "Injecting code into DOM...", "Verifying expiry headers...".`;

    const geminiAI = await getAI();
    const response = await geminiAI.models.generateContent({
      model: "gemini-2.5-flash", // Use flash for small log generation tasks
      contents: prompt,
      config: { maxOutputTokens: 30 }
    });
    return response.text?.trim() || `Processing ${merchant} data...`;
  } catch (e) {
    return `Analyzing ${merchant} nodes...`;
  }
};