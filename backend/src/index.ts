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

app.use(cors());
app.use(express.json());

app.get('/health', (_, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    regions: getAllSupportedRegions().map(r => r.code)
  });
});

app.get('/regions', (_, res) => {
  res.json(getAllSupportedRegions());
});

const verifyRequestSchema = z.object({
  merchant: z.object({
    name: z.string(),
    url: z.string(),
    region: z.string().optional(),
  }),
  codes: z.array(z.object({
    code: z.string(),
    description: z.string(),
    source: z.string().optional(),
    sourceUrl: z.string().optional(),
  })),
  testRegion: z.string().default('US'),
});

const discoverRequestSchema = z.object({
  query: z.string(),
  region: z.string().default('GLOBAL'),
});

// Health check
app.get('/health', (_, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    regions: getAllSupportedRegions().map(r => r.code)
  });
});

// Discovery endpoint - uses MiniMax to find codes
app.post('/discover', async (req, res) => {
  try {
    const { query, region } = discoverRequestSchema.parse(req.body);
    
    const result = await discoverCodes(query, region);
    
    res.json(result);
  } catch (error) {
    console.error('Discovery error:', error);
    res.status(500).json({ error: 'Discovery failed', details: String(error) });
  }
});

// Verification endpoint - REAL testing with browser/proxies
app.post('/verify', async (req, res) => {
  try {
    const { merchant, codes, testRegion } = verifyRequestSchema.parse(req.body);
    
    if (codes.length === 0) {
      return res.json({
        merchant,
        results: [],
        totalTested: 0,
        successful: 0,
        failed: 0,
        unverified: 0,
      });
    }

    const geo = getGeoLocation(testRegion);
    console.log(`Verifying ${codes.length} codes for ${merchant.name} from ${geo.country}`);

    const result = await verifyCodes(
      { name: merchant.name, url: merchant.url, region: geo.country },
      codes,
      testRegion
    );

    res.json(result);
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Verification failed', details: String(error) });
  }
});

// Batch verification
app.post('/verify-batch', async (req, res) => {
  try {
    const requests = z.array(verifyRequestSchema).parse(req.body);
    
    const results = await Promise.all(
      requests.map(req => verifyCodes(
        { name: req.merchant.name, url: req.merchant.url, region: req.merchant.region || 'US' },
        req.codes,
        req.testRegion
      ))
    );

    res.json({ results });
  } catch (error) {
    console.error('Batch verification error:', error);
    res.status(500).json({ error: 'Batch verification failed', details: String(error) });
  }
});

// Cleanup on shutdown
process.on('SIGINT', async () => {
  console.log('Cleaning up...');
  await cleanup();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Discount Hunter Verifier running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Regions: http://localhost:${PORT}/regions`);
});
