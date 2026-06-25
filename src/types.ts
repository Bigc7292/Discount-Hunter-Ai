
export enum SearchStatus {
  IDLE = 'IDLE',
  PLANNING = 'PLANNING',
  SCANNING = 'SCANNING',
  DISCOVERING = 'DISCOVERING',
  VERIFYING = 'VERIFYING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR',
  VERIFIER_OFFLINE = 'VERIFIER_OFFLINE',
}

export type CodeStatus = 'verified' | 'failed' | 'expired' | 'error' | 'unverified';

export interface CouponCode {
  code: string;
  description: string;
  discountAmount?: string;    // Actual saving detected at checkout e.g. "$12.50"
  discountText?: string;      // Raw text from checkout page e.g. "10% off applied"
  successRate: number;        // Confidence score 0-100
  lastVerified: string;       // ISO date or human-readable
  source: string;             // Where code was found
  isVerified: boolean;        // Must be true for checkout-confirmed codes
  status: CodeStatus;         // Required — no longer optional
  testedRegion?: string;      // Region where checkout was simulated
  testedAt?: string;          // ISO timestamp of when checkout was run
  errorMessage?: string;      // Error detail if code failed at checkout
  responseTime?: number;      // Milliseconds the checkout simulation took
  likelyRegion?: string;      // ISO code of where code is likely valid e.g. 'AE', 'GB', 'GLOBAL'
  regionDisplay?: string;     // Human-readable e.g. '🇦🇪 UAE' or '🌍 Global'
}

export interface Competitor {
  name: string;
  url: string;
  avgSavings: string;
}

export interface SearchResult {
  merchantName: string;
  merchantUrl: string;
  logoUrl?: string;
  codes: CouponCode[];          // ONLY verified codes — guaranteed by searchService
  unverifiedCodes?: CouponCode[]; // Codes that failed or couldn't be tested (e.g. login wall)
  unverifiedCount?: number;     // How many codes were discovered but FAILED verification
  competitors: Competitor[];
  verifierOnline: boolean;      // Was the backend verifier reachable during this search?
  stats: {
    sourcesScanned: number;
    codesDiscovered: number;    // Total candidates from AI discovery
    codesTested: number;        // How many went through checkout simulation
    codesVerified: number;      // How many PASSED checkout (matches codes.length)
    timeTaken: string;
    moneySavedEstimate: string;
  };
  groundingUrls?: string[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'system';
  source?: string;
}

export interface InboxItem {
  id: string;
  merchant: string;
  code: string;
  description: string;
  savedAt: string;
  expiresAt?: string;
  successRate?: number;
  isVerified?: boolean;
  status?: CodeStatus;
  discountAmount?: string;
  testedRegion?: string;
}

export interface HistoryEntry {
  id: string;
  query: string;
  timestamp: string;
  resultCount: number;
  merchant: string;
  verifiedCount?: number;
}

export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
  plan: 'free' | 'pro';
  searchCount: number;
  dailySearchesUsed: number;
  dailySearchLimit: number;
  credits: number;
  referralCode: string;
  referralsCount: number;
  joinedDate: string;
  isVerified: boolean;
  referredBy?: string;
  trialEndsAt?: string;
}

export interface PricingTier {
  name: string;
  price: number;
  features: string[];
  isPopular?: boolean;
}

export interface Country {
  name: string;
  code: string;
  flag: string;
}

export interface Continent {
  name: string;
  countries: Country[];
}
