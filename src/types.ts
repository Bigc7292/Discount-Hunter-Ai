
export enum SearchStatus {
  IDLE = 'IDLE',
  PLANNING = 'PLANNING',
  DISCOVERING = 'DISCOVERING',
  VERIFYING = 'VERIFYING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export type CodeStatus = 'verified' | 'failed' | 'expired' | 'error' | 'unverified';

export interface CouponCode {
  code: string;
  description: string;
  discountAmount?: string;
  successRate: number;
  lastVerified: string;
  source: string;
  isVerified: boolean;
  status?: CodeStatus;
  testedRegion?: string;
  errorMessage?: string;
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
  codes: CouponCode[];
  competitors: Competitor[];
  stats: {
    sourcesScanned: number;
    codesTested: number;
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
}

export interface HistoryEntry {
  id: string;
  query: string;
  timestamp: string;
  resultCount: number;
  merchant: string;
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
