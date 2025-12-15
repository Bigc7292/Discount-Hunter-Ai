
export enum SearchStatus {
  IDLE = 'IDLE',
  PLANNING = 'PLANNING', // AI analyzing the request
  SCANNING = 'SCANNING', // Browsing "sources"
  VALIDATING = 'VALIDATING', // "Headless browser" phase
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export interface CouponCode {
  code: string;
  description: string;
  discountAmount?: string;
  successRate: number; // 0-100
  lastVerified: string; // ISO date or "Just now"
  source: string; // e.g., "r/frugalmalefashion", "Email Newsletter"
  isVerified: boolean;
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
  groundingUrls?: string[]; // New: Real URLs found by Google Search
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'system';
  source?: string; // e.g., "Worker-1", "Puppeteer"
}

export interface InboxItem {
  id: string;
  merchant: string;
  code: string;
  description: string;
  savedAt: string;
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
  searchCount: number; // Total lifetime searches
  dailySearchesUsed: number; // New: For daily limit tracking
  dailySearchLimit: number; // New: Limit based on plan (15 for trial)
  referralCode: string; // Unique code for sharing
  referralsCount: number; // How many people they referred
  credits: number; // Earned credits
  joinedDate: string;
  isVerified: boolean; // New: Email verification status
  referredBy?: string; // New: The code of the user who referred this user
  trialEndsAt?: string; // New: Expiration date for the free trial
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
