/**
 * discovery.ts — Main discovery entry point
 *
 * Backward-compatible entry → discovery/orchestrator.ts.
 * Stages A–E work tree: ../../DISCOVERY_WORK_TREE.md
 *   Serper / Tavily / Jina / Zernio (+ Firecrawl service unused by orchestrator yet)
 *   NVIDIA optional for extract; regex always runs.
 * CORE LAW: returns candidates only — verify before any user-facing display.
 *
 * OLD: Asked LLM "what codes exist?" → training-data guesses
 * NEW: Live web sources → extract real strings → candidate pool → verify gate
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
