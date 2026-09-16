/**
 * Verified Checkout Ledger
 * Public, timestamped simulated-checkout pass/fail records.
 * Never stores full working codes — last4 + sha256 hash only.
 *
 * Persist: Firestore `checkoutLedger` when FIREBASE_SERVICE_ACCOUNT_JSON is set;
 * always keeps an in-memory ring buffer + GET /ledger works without Firebase.
 */

import { createHash } from 'crypto';
import type { CodeVerificationResult, MerchantInfo } from './types';

export type LedgerResult = 'pass' | 'fail' | 'error' | 'expired';

export interface CheckoutLedgerEntry {
  id: string;
  merchant: string;
  merchantUrl?: string;
  cartSummary: string;
  result: LedgerResult;
  testedAt: string;
  region: string;
  confidence?: number;
  codeLast4: string;
  codeHash: string;
}

export interface LedgerListOptions {
  limit?: number;
  offset?: number;
}

export interface LedgerListResponse {
  entries: CheckoutLedgerEntry[];
  total: number;
  limit: number;
  offset: number;
  source: 'firestore' | 'memory';
}

const RING_MAX = Number.parseInt(process.env.LEDGER_MEMORY_MAX || '500', 10) || 500;
const memoryRing: CheckoutLedgerEntry[] = [];

type FirestoreLike = {
  collection: (name: string) => {
    doc: (id: string) => { set: (data: Record<string, unknown>) => Promise<unknown> };
    orderBy: (field: string, dir: 'desc' | 'asc') => {
      limit: (n: number) => { get: () => Promise<{ docs: Array<{ id: string; data: () => Record<string, unknown> }>; size: number }> };
    };
  };
};

let firestoreReady: boolean | null = null;
let firestoreDb: FirestoreLike | null = null;

function redactCode(code: string): { codeLast4: string; codeHash: string } {
  const trimmed = code.trim();
  const codeLast4 = trimmed.length <= 4 ? '****' : trimmed.slice(-4);
  const codeHash = createHash('sha256').update(trimmed.toUpperCase()).digest('hex').slice(0, 16);
  return { codeLast4, codeHash };
}

function mapStatus(status: CodeVerificationResult['status']): LedgerResult {
  switch (status) {
    case 'verified':
      return 'pass';
    case 'expired':
      return 'expired';
    case 'failed':
      return 'fail';
    case 'error':
    case 'unverified':
    default:
      return 'error';
  }
}

function safeCartSummary(merchant: MerchantInfo, discountAmount?: string, discountText?: string): string {
  const name = merchant.name.replace(/[^\w\s.\-]/g, '').slice(0, 64);
  const hint = discountAmount || discountText;
  if (hint) {
    const safeHint = String(hint).replace(/[^\w\s.%$€£¥\-]/g, '').slice(0, 40);
    return `${name} cart · ${safeHint}`;
  }
  return `${name} simulated checkout`;
}

function newId(): string {
  return `led_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function pushMemory(entry: CheckoutLedgerEntry): void {
  memoryRing.unshift(entry);
  if (memoryRing.length > RING_MAX) {
    memoryRing.length = RING_MAX;
  }
}

async function initFirestore(): Promise<FirestoreLike | null> {
  if (firestoreReady === false) return null;
  if (firestoreDb) return firestoreDb;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw || !raw.trim()) {
    firestoreReady = false;
    return null;
  }

  try {
    const admin = await import('firebase-admin');
    const creds = JSON.parse(raw) as Record<string, unknown>;
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(creds as Parameters<typeof admin.credential.cert>[0]),
      });
    }
    firestoreDb = admin.firestore();
    firestoreReady = true;
    console.log('[LEDGER] Firestore persistence enabled (checkoutLedger)');
    return firestoreDb;
  } catch (err) {
    console.warn('[LEDGER] Firestore unavailable — using memory only:', err instanceof Error ? err.message : err);
    firestoreReady = false;
    firestoreDb = null;
    return null;
  }
}

async function writeFirestore(entry: CheckoutLedgerEntry): Promise<void> {
  const db = await initFirestore();
  if (!db) return;
  try {
    await db.collection('checkoutLedger').doc(entry.id).set({
      ...entry,
      createdAt: entry.testedAt,
    });
  } catch (err) {
    console.warn('[LEDGER] Firestore write failed:', err instanceof Error ? err.message : err);
  }
}

/**
 * Append a public ledger row for one simulated-checkout result.
 */
export async function appendLedgerFromResult(
  merchant: MerchantInfo,
  result: CodeVerificationResult,
  region: string
): Promise<CheckoutLedgerEntry> {
  const { codeLast4, codeHash } = redactCode(result.code);
  const entry: CheckoutLedgerEntry = {
    id: newId(),
    merchant: merchant.name,
    merchantUrl: merchant.url,
    cartSummary: safeCartSummary(merchant, result.discountAmount, result.discountText),
    result: mapStatus(result.status),
    testedAt: result.testedAt || new Date().toISOString(),
    region: region || result.testRegion || 'GLOBAL',
    confidence: typeof result.confidence === 'number' ? result.confidence : undefined,
    codeLast4,
    codeHash,
  };

  pushMemory(entry);
  void writeFirestore(entry);
  return entry;
}

/**
 * Batch-append after a verifyCodes() response.
 */
export async function appendLedgerBatch(
  merchant: MerchantInfo,
  results: CodeVerificationResult[],
  region: string
): Promise<CheckoutLedgerEntry[]> {
  const out: CheckoutLedgerEntry[] = [];
  for (const r of results) {
    out.push(await appendLedgerFromResult(merchant, r, region));
  }
  return out;
}

async function listFromFirestore(limit: number, offset: number): Promise<LedgerListResponse | null> {
  const db = await initFirestore();
  if (!db) return null;
  try {
    // Fetch offset+limit then slice (simple pagination without cursors)
    const snap = await db
      .collection('checkoutLedger')
      .orderBy('testedAt', 'desc')
      .limit(Math.min(offset + limit, 200))
      .get();

    const all = snap.docs.map(d => {
      const data = d.data() as unknown as CheckoutLedgerEntry;
      return { ...data, id: data.id || d.id };
    });
    const entries = all.slice(offset, offset + limit);
    return {
      entries,
      total: all.length >= offset + limit ? offset + limit + (snap.size === offset + limit ? 1 : 0) : offset + entries.length,
      limit,
      offset,
      source: 'firestore',
    };
  } catch (err) {
    console.warn('[LEDGER] Firestore list failed — falling back to memory:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Newest-first paginated ledger. Prefers Firestore; falls back to memory ring.
 */
export async function listLedger(opts: LedgerListOptions = {}): Promise<LedgerListResponse> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
  const offset = Math.max(opts.offset ?? 0, 0);

  const fromFs = await listFromFirestore(limit, offset);
  if (fromFs) return fromFs;

  const total = memoryRing.length;
  const entries = memoryRing.slice(offset, offset + limit);
  return { entries, total, limit, offset, source: 'memory' };
}

/** Test helper */
export function resetMemoryLedger(): void {
  memoryRing.length = 0;
}
