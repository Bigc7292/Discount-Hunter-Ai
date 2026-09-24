/**
 * Backend Verifier — Express server
 * Exposes POST /verify for real Puppeteer checkout testing.
 * Also hosts Stripe yearly/lifetime Checkout + webhook (TEST MODE).
 *
 * Fixes applied:
 * - Removed duplicate /health route
 * - Added processingTimeMs to /verify response
 * - Added unverified count to /verify response
 * - Proper CORS config
 */

import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { readdir } from 'fs/promises';
import path from 'path';
import Stripe from 'stripe';
import admin from 'firebase-admin';
import { verifyCodes } from './verifier.js';
import { getAllSupportedRegions, getGeoLocation, isGeoProxyConfigured } from './geoProxy.js';
import { cleanup, isBrowserlessConfigured } from './browserBot.js';
import { discoverCodes } from './discovery.js';
import { runVerificationTests } from './testRunner.js';
import { createProfileAccount } from './profileManager.js';
import { rateLimitMiddleware } from './rateLimit.js';
import { listLedger } from './ledger.js';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3001;

// ── Firebase Admin (optional until FIREBASE_SERVICE_ACCOUNT_JSON is set) ─────

function initFirebaseAdmin(): admin.firestore.Firestore | null {
  if (admin.apps.length) return admin.firestore();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    console.warn('[FIREBASE] FIREBASE_SERVICE_ACCOUNT_JSON not set — Stripe webhook cannot upgrade users');
    return null;
  }
  try {
    const cred = JSON.parse(raw);
    admin.initializeApp({ credential: admin.credential.cert(cred) });
    return admin.firestore();
  } catch (err) {
    console.error('[FIREBASE] Failed to init admin SDK:', err);
    return null;
  }
}

const firestore = initFirebaseAdmin();

// ── Stripe (TEST MODE) ──────────────────────────────────────────────────────

const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
const stripe = stripeSecret
  ? new Stripe(stripeSecret, { apiVersion: '2025-02-24.acacia' })
  : null;

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const YEARLY_PRICE_ID = process.env.STRIPE_YEARLY_PRICE_ID || '';
const LIFETIME_PRICE_ID = process.env.STRIPE_LIFETIME_PRICE_ID || '';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

// ── Middleware ──────────────────────────────────────────────────────────────

// Production: set FRONTEND_URL to the Vercel origin (e.g. https://your-app.vercel.app).
// When unset (local/dev), allow all origins.
const corsOrigin = process.env.FRONTEND_URL || '*';
app.use(cors({
  origin: corsOrigin,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Stripe webhook MUST receive the raw body — mount before express.json()
app.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  let event: Stripe.Event;
  try {
    const sig = req.headers['stripe-signature'];
    if (!sig || !WEBHOOK_SECRET) {
      return res.status(400).json({ error: 'Missing stripe-signature or STRIPE_WEBHOOK_SECRET' });
    }
    event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error('[STRIPE] Webhook signature verification failed:', err);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId =
        session.client_reference_id ||
        session.metadata?.userId ||
        null;

      if (!userId) {
        console.error('[STRIPE] checkout.session.completed missing userId');
      } else if (!firestore) {
        console.error('[STRIPE] Firestore admin unavailable — cannot upgrade', userId);
      } else {
        const purchasedAt = new Date().toISOString();
        const product = (session.metadata?.product || session.metadata?.plan || 'lifetime') as string;
        const plan = product === 'yearly' ? 'yearly' : 'lifetime';
        const patch: Record<string, unknown> = {
          plan,
          dailySearchLimit: 100000,
          stripeCustomerId:
            typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
          stripeCheckoutSessionId: session.id,
        };
        if (plan === 'yearly') {
          patch.yearlyPurchasedAt = purchasedAt;
        } else {
          patch.lifetimePurchasedAt = purchasedAt;
        }
        await firestore.collection('users').doc(userId).set(patch, { merge: true });
        console.log(`[STRIPE] ${plan} verified access unlocked for user ${userId}`);
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[STRIPE] Webhook handler error:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

app.use(express.json({ limit: '2mb' }));

// Trust proxy so req.ip / X-Forwarded-For work behind Railway/Vercel
app.set('trust proxy', 1);

// Rate limits — expensive discovery / checkout simulation routes
const verifyRateLimit = rateLimitMiddleware({
  prefix: 'verify',
  envKey: 'RATE_LIMIT_VERIFY_PER_MIN',
  defaultPerMin: 10,
});
const discoverRateLimit = rateLimitMiddleware({
  prefix: 'discover',
  envKey: 'RATE_LIMIT_DISCOVER_PER_MIN',
  defaultPerMin: 20,
});
const testsRateLimit = rateLimitMiddleware({
  prefix: 'tests',
  envKey: 'RATE_LIMIT_VERIFY_PER_MIN',
  defaultPerMin: 10,
});

// ── Request schemas ─────────────────────────────────────────────────────────

const verifyRequestSchema = z.object({
  merchant: z.object({
    name: z.string().min(1),
    url: z.string().url(),
    region: z.string().optional(),
  }),
  codes: z.array(z.object({
    code: z.string().min(1).max(50),
    description: z.string(),
    source: z.string().optional(),
    sourceUrl: z.string().optional(),
  })).min(1).max(50), // Sanity ceiling (abuse guard) — NOT a product verify-cap; all discovery codes must be tested
  testRegion: z.string().default('US'),
});

const discoverRequestSchema = z.object({
  query: z.string().min(1),
  region: z.string().default('GLOBAL'),
});

const testCaseSchema = z.object({
  name: z.string().min(1),
  request: z.object({
    merchant: z.object({
      name: z.string().min(1),
      url: z.string().url(),
    }),
    codes: z.array(z.object({
      code: z.string().min(1),
      description: z.string().min(1),
    })).min(1),
    testRegion: z.string().default('US'),
  }),
});

const testRunRequestSchema = z.object({
  testCases: z.array(testCaseSchema).min(1),
});

async function verifyFirebaseIdToken(authHeader: string | undefined): Promise<string> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw Object.assign(new Error('Missing Authorization Bearer token'), { status: 401 });
  }
  if (!admin.apps.length) {
    throw Object.assign(new Error('Firebase Admin not configured'), { status: 503 });
  }
  const token = authHeader.slice(7);
  const decoded = await admin.auth().verifyIdToken(token);
  return decoded.uid;
}

// ── Routes ──────────────────────────────────────────────────────────────────

// Health check (single definition)
app.get('/health', (_req, res) => {
  const envProxy = !!(process.env.PROXY_SERVER || process.env.RESIDENTIAL_PROXY_URL);
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    regions: getAllSupportedRegions().map(r => r.code),
    version: '2.0.0',
    stripe: !!stripe,
    firebaseAdmin: !!firestore,
    browserlessConfigured: isBrowserlessConfigured(),
    geoProxyConfigured: isGeoProxyConfigured(),
    envProxyOverride: envProxy,
  });
});

// Supported regions list
app.get('/regions', (_req, res) => {
  res.json(getAllSupportedRegions());
});

// Stripe — create yearly (subscription) or lifetime (one-time) Checkout Session (TEST MODE)
app.post('/stripe/create-checkout-session', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({
        error: 'Stripe not configured. Set STRIPE_SECRET_KEY and price IDs.',
      });
    }

    const planRaw = (req.body?.plan || 'lifetime') as string;
    const plan = planRaw === 'yearly' ? 'yearly' : 'lifetime';
    const priceId = plan === 'yearly' ? YEARLY_PRICE_ID : LIFETIME_PRICE_ID;

    if (!priceId) {
      const missing = plan === 'yearly' ? 'STRIPE_YEARLY_PRICE_ID' : 'STRIPE_LIFETIME_PRICE_ID';
      return res.status(503).json({
        error: `Stripe not configured. Set STRIPE_SECRET_KEY and ${missing}.`,
      });
    }

    const userId = await verifyFirebaseIdToken(req.headers.authorization);

    const session = await stripe.checkout.sessions.create({
      mode: plan === 'yearly' ? 'subscription' : 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${FRONTEND_URL}?checkout=success&plan=${plan}`,
      cancel_url: `${FRONTEND_URL}?checkout=cancel`,
      client_reference_id: userId,
      metadata: { userId, product: plan, plan },
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return res.status(500).json({ error: 'Stripe did not return a checkout URL' });
    }

    res.json({ url: session.url, sessionId: session.id, plan });
  } catch (error: any) {
    const status = error?.status || 500;
    console.error('[STRIPE] create-checkout-session error:', error);
    res.status(status).json({ error: error?.message || 'Failed to create checkout session' });
  }
});

// Discovery — real multi-source web discovery
app.post('/discover', discoverRateLimit, async (req, res) => {
  try {
    const { query, region } = discoverRequestSchema.parse(req.body);

    console.log(`[DISCOVER] Query: "${query}" | Region: ${region}`);
    const result = await discoverCodes(query, region);

    // Map orchestrator output to the format frontend searchService.ts expects
    const response = {
      merchantName: result.storeName,
      merchantUrl: `https://${result.domain}`,
      suggestedCodes: result.candidates.map(c => ({
        code: c.code,
        description: c.discount
          ? `${c.discount}${c.expiry ? ` — expires ${c.expiry}` : ''}`
          : c.description || 'Discovered from live web sources',
        source: c.source,
        sourceUrl: c.sourceUrl,
        discoveredAt: c.discoveredAt,
        discoveryConfidence: c.confidence === 'high' ? 85
          : c.confidence === 'medium' ? 60
          : 35,
        likelyRegion: c.likelyRegion,
        regionDisplay: c.regionDisplay,
      })),
      competitors: [],
      groundingUrls: [...new Set(result.candidates.map(c => c.sourceUrl).filter(Boolean))],
      // Extra metadata for UI
      meta: {
        sourcesSearched: result.sourcesSearched,
        totalTextsAnalysed: result.totalTextsAnalysed,
        discoveryDurationMs: result.durationMs,
      },
    };

    console.log(`[DISCOVER] Returning ${response.suggestedCodes.length} candidates to frontend`);
    res.json(response);

  } catch (error) {
    console.error('Discovery error:', error);
    res.status(500).json({ error: 'Discovery failed', details: String(error) });
  }
});


// Test runner — execute a batch of verification cases and save structured logs
app.post('/tests/run', testsRateLimit, async (req, res) => {
  try {
    const body = testRunRequestSchema.parse(req.body);
    const summary = await runVerificationTests(body.testCases as Array<{ name: string; request: { merchant: { name: string; url: string; region: string }; codes: Array<{ code: string; description: string; source: string; sourceUrl?: string; discoveredAt: string }>; testRegion: string } }>);
    res.json(summary);
  } catch (error) {
    console.error('[TESTS] Error:', error);
    res.status(500).json({ error: 'Test run failed', details: String(error) });
  }
});

app.post('/profiles/create', async (_req, res) => {
  const account = createProfileAccount('testing');
  res.json({ account });
});

app.get('/tests/logs', async (_req, res) => {
  try {
    const logDir = path.resolve(process.cwd(), 'logs');
    const entries = await readdir(logDir, { withFileTypes: true });
    const files = entries
      .filter(entry => entry.isFile())
      .map(entry => entry.name)
      .sort((a, b) => b.localeCompare(a));
    res.json({ logDir, files });
  } catch (error) {
    res.json({ logDir: path.resolve(process.cwd(), 'logs'), files: [] });
  }
});

// Verify — REAL checkout testing with Puppeteer
app.post('/verify', verifyRateLimit, async (req, res) => {
  const requestStart = Date.now();

  try {
    const body = verifyRequestSchema.parse(req.body);
    const { merchant, codes, testRegion } = body;

    if (codes.length === 0) {
      return res.json({
        merchant,
        results: [],
        totalTested: 0,
        successful: 0,
        failed: 0,
        unverified: 0,
        processingTimeMs: Date.now() - requestStart,
      });
    }

    const geo = getGeoLocation(testRegion);
    console.log(`[VERIFY] ${codes.length} codes for "${merchant.name}" | Region: ${geo.country}`);

    const request = {
      merchant: {
        name: merchant.name,
        url: merchant.url,
        region: merchant.region || geo.country,
      },
      codes: codes.map(c => ({
        code:        c.code,
        description: c.description,
        source:      c.source || 'Unknown',
        sourceUrl:   c.sourceUrl,
        discoveredAt: new Date().toISOString(),
      })),
      testRegion,
    };

    const result = await verifyCodes(request);
    const processingTimeMs = Date.now() - requestStart;

    // Count statuses
    const successful  = result.results.filter(r => r.status === 'verified').length;
    const failed      = result.results.filter(r => r.status === 'failed' || r.status === 'expired').length;
    const unverified  = result.results.filter(r => r.status === 'unverified' || r.status === 'error').length;

    console.log(`[VERIFY] Done: ${successful} verified, ${failed} failed, ${unverified} unverified | ${processingTimeMs}ms`);

    res.json({
      ...result,
      successful,
      failed,
      unverified,
      processingTimeMs,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request',
        details: error.errors,
      });
    }
    console.error('[VERIFY] Error:', error);
    res.status(500).json({
      error: 'Verification failed',
      details: String(error),
      processingTimeMs: Date.now() - requestStart,
    });
  }
});


// Public verified-checkout ledger (newest first, no full codes)
app.get('/ledger', async (req, res) => {
  try {
    const limit = Number.parseInt(String(req.query.limit ?? '50'), 10);
    const offset = Number.parseInt(String(req.query.offset ?? '0'), 10);
    const data = await listLedger({
      limit: Number.isFinite(limit) ? limit : 50,
      offset: Number.isFinite(offset) ? offset : 0,
    });
    res.json(data);
  } catch (error) {
    console.error('[LEDGER] list error:', error);
    res.status(500).json({ error: 'Failed to load ledger', details: String(error) });
  }
});

// ── Graceful shutdown ───────────────────────────────────────────────────────

async function shutdown() {
  console.log('\n[SERVER] Shutting down — cleaning up browser instances...');
  await cleanup();
  console.log('[SERVER] Clean shutdown complete.');
  process.exit(0);
}

process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);

// ── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀 Discount Hunter Verifier v2.0.0`);
  console.log(`   Port:    ${PORT}`);
  console.log(`   Health:  http://localhost:${PORT}/health`);
  console.log(`   Regions: http://localhost:${PORT}/regions`);
  console.log(`   Stripe:  ${stripe ? 'CONFIGURED' : 'NOT SET'}`);
  console.log(`   Ledger:  http://localhost:${PORT}/ledger`);
  console.log(`   Headless: ${process.env.USE_HEADLESS_BROWSER !== 'false'}`);
  console.log(`   RateLim: verify=${process.env.RATE_LIMIT_VERIFY_PER_MIN || '10'}/min discover=${process.env.RATE_LIMIT_DISCOVER_PER_MIN || '20'}/min`);
  const browserlessOn = isBrowserlessConfigured();
  const geoOn = isGeoProxyConfigured();
  const envProxy = !!(process.env.PROXY_SERVER || process.env.RESIDENTIAL_PROXY_URL);
  console.log(`   Browserless: ${browserlessOn ? 'CONFIGURED (hosted Chrome primary)' : 'NOT SET (local Chromium fallback)'}`);
  if (browserlessOn) {
    const ws = process.env.BROWSERLESS_WS_ENDPOINT?.trim() || 'wss://production-sfo.browserless.io';
    console.log(`   BrowserlessWS: ${ws}`);
  }
  console.log(`   GeoProxy: ${geoOn ? 'CONFIGURED (residential key set)' : 'NOT SET (geo-testing disabled)'}`);
  if (geoOn) {
    console.log(`   GeoHost: ${process.env.RESIDENTIAL_PROXY_HOST || 'brd.superproxy.io'}:${process.env.RESIDENTIAL_PROXY_PORT || '22225'} zone=${process.env.RESIDENTIAL_PROXY_ZONE || 'residential'} customer=${process.env.RESIDENTIAL_PROXY_CUSTOMER ? 'SET' : 'unset (legacy username)'}`);
  }
  console.log(`   EnvProxy: ${envProxy ? 'SET (global Chromium override)' : 'not set'}`);
  console.log('');
});
