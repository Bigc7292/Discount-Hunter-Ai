/**
 * Code Extractor — pulls actual promo codes from raw text
 *
 * Two-stage pipeline:
 *   1. Regex fast-pass  (free, instant, high precision)
 *   2. NVIDIA LLM pass  (catches messy formats regex misses)
 */

import 'dotenv/config';
import { inferRegionFromSource } from './regionUtils.js';

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const NVIDIA_MODEL = 'meta/llama-3.3-70b-instruct';

// ── Filters ──────────────────────────────────────────────────────────────────

/** Strings that look like codes but definitely aren't */
const FALSE_POSITIVE_PATTERNS = [
  /^[0-9]+$/,                           // Pure numbers
  /^[A-Z]{1,2}[0-9]{8,}$/,             // Tracking/order IDs
  // Common English words that appear in ALL-CAPS in snippets
  /^(HTTP|HTTPS|WWW|URL|API|SDK|CSS|HTML|JSON|UUID|NULL|TRUE|FALSE|NAN|INF)$/,
  /^(ASIN|ISBN|SKU|UPC|EAN|GTIN|GTM|UTM|SEO|FAQ|TOS|TOC|CTA|ROI|KPI)$/,
  /^(UAE|USA|UK|AUS|EUR|GBP|USD|AED|SAR|KWD|BHD|OMR|QAR|EGP|JOD)$/,  // Currency/geo codes
  /^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|MON|TUE|WED|THU|FRI|SAT|SUN)$/, // Dates
  // Common English words that appear in all-caps text
  /^(CODE|CODES|COUPON|COUPONS|PROMO|PROMOS|DEAL|DEALS|SALE|SALES|SAVE|SAVINGS)$/,
  /^(BLOG|BLOGS|SITE|SITES|SHOP|STORE|BRAND|LADY|JUST|BELOW|WITH|FROM|THAT|THIS|THEN|WHEN|WHAT|WHERE|ONLY|ALSO|SOME|MANY|MOST|INTO|ONTO|OVER|AFTER|BEFORE|ABOUT|ABOVE|UNDER)$/,
  /^(FREE|GIFT|ITEM|ITEMS|LINK|LIST|MORE|NEED|NEXT|NOTE|OPEN|PAID|PASS|PLUS|SAME|SEND|SHOW|SIZE|TAKE|TELL|TEXT|THEY|THEM|THEN|TIME|TIPS|TOLD|TYPE|USED|VIEW|WANT|WAYS|WEEK|WILL|WITH|WORK|YEAR|YOUR|ZERO)$/,
  /^(SETUP|SHARE|TODAY|WINDOW|BUYER|LOVER|BELOW|CHECK|CLICK|EVERY|FOUND|GIVEN|GREAT|GUIDE|HELPS|HOURS|INBOX|INPUT|JOKER|KEEPS|KINDS|KNOWN|LARGE|LEARN|LEVEL|LIMIT|MAKER|MATCH|MEANS|MIGHT|MONEY|MONTH|MOVES|NAMED|NEEDS|NEVER|NEWER|NIGHT|NOTED|ORDER|OTHER|OWNER|PLACE|PLAIN|PLANS|PLAYS|PRESS|PRICE|PRINT|PRIOR|PROOF|PROVE|PULLS|QUITE|QUOTE|RAISE|RANGE|RANKS|REACH|READS|READY|REFER|RIGHT|RULES|SCORE|SEEMS|SELLS|SENSE|SERVE|SEVEN|SHARE|SHORT|SINCE|SIXTH|SIZES|SKILL|SMALL|SMART|SOLID|SOLVE|SPEND|SPLIT|STAND|START|STATE|STEPS|STOCK|STORE|STUFF|STYLE|SUPER|SWEET|SWIFT|TABLE|TAKEN|TASTE|TAXES|TEACH|TEAMS|THANK|THERE|THESE|THINK|THOSE|THREE|THREW|TITLE|TODAY|TOKEN|TOOLS|TOPIC|TOTAL|TOUCH|TOUGH|TOWNS|TRIED|TRUST|TRUTH|TURNS|TWICE|TYPED|UNDER|UNION|UNITY|UNTIL|USING|USUAL|VALID|VALUE|VISIT|VOICE|VOTED|WHERE|WHICH|WHILE|WHOSE|WIDER|WORLD|WORTH|WRITE|WROTE)$/,
];

function isFalsePositive(code: string): boolean {
  return FALSE_POSITIVE_PATTERNS.some(p => p.test(code));
}

// ── Stage 1: Regex extraction ─────────────────────────────────────────────────

/** High-confidence patterns (labelled codes) */
const LABELED_PATTERNS = [
  // "use code SAVE20" / "promo code: DEAL15" / "coupon SUMMER30"
  /(?:use\s+code|promo\s+code|coupon\s+code|discount\s+code|voucher\s+code|gift\s+code|referral\s+code|promo|coupon|voucher|code)[:\s"']+([A-Z][A-Z0-9_\-]{3,20})/gi,
  // "enter SAVE20 at checkout" / "apply FLAT10 at checkout"
  /(?:enter|apply|redeem|type|input)\s+["']?([A-Z][A-Z0-9_\-]{3,20})["']?\s+(?:at|during|on|in|for)\s+checkout/gi,
  // Quoted codes: "SAVE20", 'DEAL15'
  /["']([A-Z][A-Z0-9_\-]{4,20})["']/g,
  // Parentheses: (code: SAVE20) or (SAVE20)
  /\((?:code:\s*)?([A-Z][A-Z0-9_\-]{4,20})\)/g,
];

/** Lower-confidence standalone ALL-CAPS patterns — MUST contain at least one digit */
const STANDALONE_PATTERNS = [
  // Alphanumeric WITH digits: SAVE20, FLAT10, SUMMER30, CBDNOV10, ADCB20
  // Requires letters + digits mixed — pure words (CODES, BLOGS) are excluded
  /\b([A-Z]{2,12}[0-9]{1,6}[A-Z]{0,4}|[0-9]{1,3}[A-Z]{3,12})\b/g,
];

export interface ExtractedCode {
  code: string;
  confidence: 'high' | 'medium' | 'low';
  pattern: string;
  context?: string;
}

export function extractCodesWithRegex(text: string): ExtractedCode[] {
  const found = new Map<string, ExtractedCode>();
  const normalized = text.toUpperCase();

  // High-confidence labelled patterns
  for (const pattern of LABELED_PATTERNS) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      const captured = match[1] || match[0];
      const hasDigits = /[0-9]/.test(captured);
      const isFullyUppercase = /^[A-Z0-9_\-]+$/.test(captured);
      if (!hasDigits && !isFullyUppercase) continue;

      const rawCode = captured.toUpperCase().trim().replace(/[^A-Z0-9_\-]/g, '');
      if (rawCode.length >= 4 && rawCode.length <= 24 && !isFalsePositive(rawCode)) {
        const startIdx = Math.max(0, (match.index || 0) - 40);
        const context = text.slice(startIdx, (match.index || 0) + rawCode.length + 40).trim();
        if (!found.has(rawCode)) {
          found.set(rawCode, { code: rawCode, confidence: 'high', pattern: 'labelled', context });
        }
      }
    }
  }

  // Lower-confidence standalone patterns
  for (const pattern of STANDALONE_PATTERNS) {
    const matches = [...normalized.matchAll(pattern)];
    for (const match of matches) {
      const rawCode = (match[1] || match[0]).trim().replace(/[^A-Z0-9_\-]/g, '');
      if (rawCode.length >= 4 && rawCode.length <= 20 && !found.has(rawCode) && !isFalsePositive(rawCode)) {
        found.set(rawCode, { code: rawCode, confidence: 'low', pattern: 'standalone' });
      }
    }
  }

  return [...found.values()];
}

// ── Stage 2: NVIDIA LLM extraction ───────────────────────────────────────────

interface LLMCode {
  code: string;
  discount?: string;
  expiry?: string | null;
  confidence: 'high' | 'medium' | 'low';
}

async function extractCodesWithLLM(text: string, storeName: string): Promise<LLMCode[]> {
  if (!NVIDIA_API_KEY) return [];

  // Truncate text to save tokens (most codes appear early)
  const truncated = text.slice(0, 3000);

  const prompt = `You are a discount code extractor. Extract all promotional/discount codes from the text below for "${storeName}".

RULES:
- Only return ACTUAL discount codes (e.g. SAVE20, FLAT10, SUMMER30, AMAZON15)
- Do NOT return order IDs, tracking numbers, or product SKUs
- Do NOT invent codes — only extract what is literally in the text
- If no codes found, return empty array

TEXT:
${truncated}

Return ONLY valid JSON: {"codes": [{"code": "STRING", "discount": "e.g. 20% off or null", "expiry": "date or null", "confidence": "high|medium|low"}]}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 512,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!response.ok) return [];

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    return (parsed.codes || []).filter((c: any) => c.code && c.code.length >= 4);

  } catch {
    return [];
  }
}

// ── Combined extraction ───────────────────────────────────────────────────────

export interface CandidateCode {
  code: string;
  confidence: 'high' | 'medium' | 'low';
  source: string;
  sourceUrl: string;
  description: string;
  discoveredAt: string;
  discount?: string;
  expiry?: string | null;
  likelyRegion: string;      // ISO country code or 'GLOBAL'
  regionDisplay: string;     // e.g. '🇦🇪 UAE' or '🌍 Global'
}

export async function extractCodes(
  text: string,
  storeName: string,
  sourceLabel: string,
  sourceUrl: string,
  userRegion: string = 'GLOBAL',
): Promise<CandidateCode[]> {
  // Stage 1: regex (fast)
  const regexCodes = extractCodesWithRegex(text);

  // Stage 2: LLM (for messy text if regex found few)
  let llmCodes: LLMCode[] = [];
  if (regexCodes.filter(c => c.confidence === 'high').length < 2) {
    llmCodes = await extractCodesWithLLM(text, storeName);
  }

  // Merge: LLM results upgrade low-confidence regex matches
  const merged = new Map<string, CandidateCode>();

  // Infer region once per source (not per code)
  const { REGION_META } = await import('./regionUtils.js');
  const likelyRegion = inferRegionFromSource(sourceUrl, sourceLabel, userRegion);
  const regionMeta = REGION_META[likelyRegion];
  const regionDisplay = regionMeta ? `${regionMeta.flag} ${regionMeta.name}` : likelyRegion;

  for (const r of regexCodes) {
    merged.set(r.code, {
      code: r.code,
      confidence: r.confidence,
      source: sourceLabel,
      sourceUrl,
      description: r.context ? `Found in: "${r.context.slice(0, 80)}"` : `Extracted via pattern match`,
      discoveredAt: new Date().toISOString(),
      likelyRegion,
      regionDisplay,
    });
  }

  for (const l of llmCodes) {
    const code = l.code.toUpperCase().trim();
    if (code.length < 4 || isFalsePositive(code)) continue;

    const existing = merged.get(code);
    if (existing) {
      // Upgrade confidence if LLM agrees
      if (l.confidence === 'high') existing.confidence = 'high';
      existing.discount = l.discount;
      existing.expiry = l.expiry;
    } else {
      merged.set(code, {
        code,
        confidence: l.confidence,
        source: sourceLabel,
        sourceUrl,
        description: l.discount ? `${l.discount}${l.expiry ? ` — expires ${l.expiry}` : ''}` : 'Found by AI extraction',
        discoveredAt: new Date().toISOString(),
        discount: l.discount,
        expiry: l.expiry,
        likelyRegion,
        regionDisplay,
      });
    }
  }

  return [...merged.values()];
}
