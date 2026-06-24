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
}

export interface VerificationResponse {
  merchant: MerchantInfo;
  results: CodeVerificationResult[];
  totalTested: number;
  successful: number;
  failed: number;
  testedAt: string;
  region: string;
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