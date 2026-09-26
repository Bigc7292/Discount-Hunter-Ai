export interface CandidateCode {
  code: string;
  description: string;
  source: string;
  sourceUrl?: string;
  discoveredAt: string;
}

export interface MerchantInfo {
  name: string;
  url: string;
  region: string;
}

export interface VerificationRequest {
  merchant: MerchantInfo;
  codes: CandidateCode[];
  testRegion: string;
}

/**
 * Where a code's checkout attempt ended.
 * 'applied' = the code was actually entered in the store's promo field and the store answered.
 * Everything else = the code could NOT be tested (never reached the promo field).
 */
export type VerifyStage =
  | 'applied'
  | 'browser_connect'
  | 'proxy_auth'
  | 'bot_blocked'
  | 'cart_bootstrap'
  | 'no_promo_field'
  | 'timeout'
  | 'navigation'
  | 'skipped'
  | 'unknown';

export interface CodeVerificationResult {
  code: string;
  status: 'verified' | 'failed' | 'expired' | 'error' | 'unverified';
  confidence: number;
  discountText?: string;    // Raw text detected at checkout e.g. "SAVE20 applied"
  discountAmount?: string;  // Extracted amount e.g. "$12.50" or "20% off"
  errorMessage?: string;
  testedAt: string;
  testRegion: string;
  responseTime?: number;
  terms?: string[];
  /** true ONLY when the code was entered at the promo field and the store responded */
  reachedPromoField?: boolean;
  /** Stage where the attempt ended ('applied' when reachedPromoField) */
  stage?: VerifyStage;
}

export interface VerificationResponse {
  merchant: MerchantInfo;
  results: CodeVerificationResult[];
  /** Codes actually applied at the promo field (NOT just attempted) */
  totalTested: number;
  successful: number;
  /** Tested codes the store rejected / expired */
  failed: number;
  testedAt: string;
  region: string;
  /** All codes submitted to the verifier */
  totalAttempted?: number;
  /** Codes that never reached the promo field (browser/proxy/bot/cart/timeout) */
  couldNotTest?: number;
  /** Dominant human reason for couldNotTest (no code strings) */
  couldNotTestReason?: string;
  /** Per-stage counts, e.g. { browser_connect: 20 } */
  stageCounts?: Partial<Record<VerifyStage, number>>;
  /** Honest one-line status, e.g. "0 of 20 codes could be tested: checkout browser could not start" */
  testSummary?: string;
  /** Hosted-browser route used for the batch (no secrets) */
  browserRoute?: string;
  /** Browser provider used for the batch: kernel | cloudflare | browserless | local */
  browserProvider?: string;
  /** Wall-clock seconds of browser session time on that provider for this run */
  browserSeconds?: number;
}

export interface GeoLocation {
  code: string;
  country: string;
  countryCode: string;
  region: string;
  proxy?: ProxyConfig;
}

export interface ProxyConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  provider: string;
}

export interface BrowserTestResult {
  success: boolean;
  finalPrice?: string;
  originalPrice?: string;
  discountText?: string;
  discountAmount?: string;
  discountDetected?: boolean;
  errorMessage?: string;
  pageLoadTime: number;
}
