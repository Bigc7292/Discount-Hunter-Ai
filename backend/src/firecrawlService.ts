// backend/src/firecrawlService.ts
// Thin wrapper around the Firecrawl MCP (https://www.firecrawl.dev/)
// Returns cleaned Markdown for a given URL. Uses FIRECRAWL_API_KEY env var.

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const FIRECRAWL_BASE_URL = 'https://api.firecrawl.dev/v1/scrape';

/**
 * Fetch cleaned markdown for a remote page.
 * @param url The page URL to scrape.
 * @returns markdown string (or empty string on failure).
 */
export async function fetchCleanedMarkdown(url: string): Promise<string> {
  if (!FIRECRAWL_API_KEY) {
    console.warn('[Firecrawl] API key not set – returning raw page');
    return '';
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(FIRECRAWL_BASE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        format: 'markdown', // request markdown output (cheaper for LLM)
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[Firecrawl] API error ${response.status}`);
      return '';
    }

    const data = await response.json();
    if (typeof data?.markdown === 'string') {
      return data.markdown;
    }
    console.warn('[Firecrawl] Unexpected response shape');
    return '';
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      console.error('[Firecrawl] Request failed', err);
    }
    return '';
  }
}
