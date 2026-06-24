/**
 * discovery.ts — Main discovery entry point
 *
 * This file is kept for backward compatibility with index.ts imports.
 * It delegates to the new multi-source discovery orchestrator which uses:
 *   - Serper.dev (Google search)
 *   - Jina Reader (coupon page scraper)
 *   - Zernio (Reddit + social media)
 *   - Tavily (AI web search)
 *   - NVIDIA LLM (code extraction from scraped text)
 *
 * OLD BEHAVIOR (replaced): Asked LLM "what codes exist?" → AI guessed from training data
 * NEW BEHAVIOR: Searches real web sources, extracts actual code strings from text
 */

import { discoverCodes as orchestratorDiscoverCodes, DiscoveryResult } from './discovery/orchestrator.js';
export type { DiscoveryResult };

/**
 * Discover real discount codes for a store query using live web search.
 * Returns candidates for Puppeteer verification.
 */
export async function discoverCodes(query: string, region: string = 'GLOBAL'): Promise<DiscoveryResult> {
  return orchestratorDiscoverCodes(query, region);
}
