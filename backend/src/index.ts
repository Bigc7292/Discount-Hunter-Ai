/**
 * Backend Verifier — Express server
 * Exposes POST /verify for real Puppeteer checkout testing.
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
import { verifyCodes } from './verifier.js';
import { getAllSupportedRegions, getGeoLocation } from './geoProxy.js';
import { cleanup } from './browserBot.js';
import { discoverCodes } from './discovery.js';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──────────────────────────────────────────────────────────────

app.use(cors({
  origin: '*', // Tighten this to your Vercel domain in production
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '2mb' }));

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
  })).min(1).max(10), // Cap at 10 — prevents Puppeteer overload
  testRegion: z.string().default('US'),
});

const discoverRequestSchema = z.object({
  query: z.string().min(1),
  region: z.string().default('GLOBAL'),
});

// ── Routes ──────────────────────────────────────────────────────────────────

// Health check (single definition)
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    regions: getAllSupportedRegions().map(r => r.code),
    version: '2.0.0',
  });
});

// Supported regions list
app.get('/regions', (_req, res) => {
  res.json(getAllSupportedRegions());
});

// Discovery — real multi-source web discovery
app.post('/discover', async (req, res) => {
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


// Verify — REAL checkout testing with Puppeteer
app.post('/verify', async (req, res) => {
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
  console.log(`   Headless: ${process.env.USE_HEADLESS_BROWSER !== 'false'}`);
  console.log(`   Proxy:   ${process.env.RESIDENTIAL_PROXY_API_KEY ? 'CONFIGURED' : 'NOT SET (geo-testing disabled)'}`);
  console.log('');
});
