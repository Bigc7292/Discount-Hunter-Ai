/**
 * Agent-Reach Discovery Adapter
 *
 * Integrates free multi-platform discovery angles inspired by
 * [Panniantong/Agent-Reach](https://github.com/Panniantong/Agent-Reach) (MIT)
 * into the internal candidate pool.
 *
 * CORE LAW: output = CANDIDATES only → existing verify gate. Never user-facing.
 *
 * Strategy (matches owner constraints):
 *   A) Invoke `agent-reach` / documented upstream CLIs when present in PATH
 *      (yt-dlp YouTube search; optional twitter/rdt/opencli when cookies set)
 *   B) Node zero-config pieces without cookies:
 *      - Exa MCP HTTP (`https://mcp.exa.ai/mcp`) — keyless, rate-limited
 *      - Jina Reader already covers web read elsewhere; not duplicated here
 *   C) Reddit/X cookie paths: stub + log — optional sidecar / owner session later
 *
 * Graceful no-op when CLI/deps missing or AGENT_REACH_ENABLED=0.
 * Do NOT invent a desktop cookie session on Render.
 */

import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { delimiter, join } from 'node:path';

export interface AgentReachResult {
  text: string;
  url: string;
  source: string;
}

const EXA_MCP_URL = process.env.EXA_MCP_URL || 'https://mcp.exa.ai/mcp?tools=web_search_exa';
const CLI_TIMEOUT_MS = Number(process.env.AGENT_REACH_CLI_TIMEOUT_MS || 20_000);
const EXA_TIMEOUT_MS = Number(process.env.AGENT_REACH_EXA_TIMEOUT_MS || 18_000);

function isEnabled(): boolean {
  const flag = (process.env.AGENT_REACH_ENABLED || '1').trim().toLowerCase();
  return !['0', 'false', 'off', 'no'].includes(flag);
}

/** Resolve an executable on PATH (or AGENT_REACH_BIN for agent-reach). */
async function resolveBin(name: string): Promise<string | null> {
  if (name === 'agent-reach' && process.env.AGENT_REACH_BIN) {
    try {
      await access(process.env.AGENT_REACH_BIN, fsConstants.X_OK);
      return process.env.AGENT_REACH_BIN;
    } catch {
      /* fall through to PATH */
    }
  }

  const pathEnv = process.env.PATH || '';
  for (const dir of pathEnv.split(delimiter)) {
    if (!dir) continue;
    const candidate = join(dir, name);
    try {
      await access(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      /* try next */
    }
  }
  return null;
}

function runCli(
  bin: string,
  args: string[],
  timeoutMs: number = CLI_TIMEOUT_MS,
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise(resolve => {
    const child = spawn(bin, args, {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({ ok: false, stdout, stderr: stderr || 'timeout' });
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
      if (stdout.length > 200_000) stdout = stdout.slice(0, 200_000);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
      if (stderr.length > 40_000) stderr = stderr.slice(0, 40_000);
    });
    child.on('error', err => {
      clearTimeout(timer);
      resolve({ ok: false, stdout, stderr: err.message });
    });
    child.on('close', code => {
      clearTimeout(timer);
      resolve({ ok: code === 0, stdout, stderr });
    });
  });
}

/** Parse MCP streamable-HTTP / SSE JSON-RPC body into the first result object. */
function parseMcpSseJson(body: string): any | null {
  // Prefer SSE data lines; also accept bare JSON
  const dataLines = body
    .split(/\r?\n/)
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).trim())
    .filter(Boolean);

  const candidates = dataLines.length > 0 ? dataLines : [body.trim()];
  for (const raw of candidates) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.result || parsed?.error) return parsed;
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * Zero-config Exa semantic search via hosted MCP (no API key required; rate-limited).
 * FACT: Agent-Reach routes Exa through mcporter; we call the same free MCP HTTP endpoint from Node.
 */
async function searchExaMcp(query: string, numResults: number = 5): Promise<AgentReachResult[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EXA_TIMEOUT_MS);

    const response = await fetch(EXA_MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'web_search_exa',
          arguments: { query, numResults },
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[AgentReach] Exa MCP HTTP ${response.status}`);
      return [];
    }

    const body = await response.text();
    const rpc = parseMcpSseJson(body);
    if (!rpc?.result) {
      if (rpc?.error) console.warn('[AgentReach] Exa MCP error:', rpc.error?.message || rpc.error);
      return [];
    }

    const content = rpc.result.content;
    const texts: string[] = Array.isArray(content)
      ? content.filter((c: any) => c?.type === 'text' && c.text).map((c: any) => String(c.text))
      : typeof rpc.result === 'string'
        ? [rpc.result]
        : [];

    const results: AgentReachResult[] = [];
    for (const block of texts) {
      // Exa MCP text is often "Title: …\nURL: …\n…\n---\nTitle: …"
      const chunks = block.split(/\n---\n/).map(s => s.trim()).filter(Boolean);
      for (const chunk of chunks.length ? chunks : [block]) {
        const urlMatch = chunk.match(/URL:\s*(\S+)/i);
        const titleMatch = chunk.match(/Title:\s*(.+)/i);
        const url = urlMatch?.[1]?.trim() || '';
        const title = titleMatch?.[1]?.trim() || 'Exa result';
        if (chunk.length < 20) continue;
        results.push({
          text: `${title}\n${chunk}`.slice(0, 6000),
          url,
          source: 'Agent-Reach: Exa MCP (web_search_exa)',
        });
      }
    }

    return results;
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      console.warn('[AgentReach] Exa MCP failed:', (error as Error).message);
    }
    return [];
  }
}

/**
 * YouTube search via yt-dlp when present (Agent-Reach zero-config YouTube channel).
 * Candidates only — titles/descriptions may mention codes; verify gate still required.
 */
async function searchYoutubeViaYtDlp(storeName: string): Promise<AgentReachResult[]> {
  const bin = await resolveBin('yt-dlp');
  if (!bin) return [];

  const query = `ytsearch5:${storeName} promo code discount coupon`;
  const { ok, stdout } = await runCli(bin, [
    '--flat-playlist',
    '--dump-json',
    '--no-download',
    '--quiet',
    '--no-warnings',
    query,
  ]);

  if (!ok && !stdout.trim()) return [];

  const results: AgentReachResult[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const item = JSON.parse(line);
      const title = item.title || item.fulltitle || '';
      const desc = item.description || item.playlist_title || '';
      const id = item.id || item.url || '';
      const url =
        item.webpage_url ||
        item.url ||
        (id && !String(id).startsWith('http') ? `https://www.youtube.com/watch?v=${id}` : String(id));
      const text = [title, desc].filter(Boolean).join('\n').trim();
      if (text.length < 10) continue;
      results.push({
        text: text.slice(0, 4000),
        url: typeof url === 'string' ? url : '',
        source: 'Agent-Reach: yt-dlp (YouTube search)',
      });
    } catch {
      /* skip bad line */
    }
  }
  return results;
}

/**
 * Optional: run `agent-reach doctor --json` when CLI present (capability probe only).
 * Does not block discovery; used for logging / future routing.
 */
async function probeAgentReachDoctor(): Promise<void> {
  const bin = await resolveBin('agent-reach');
  if (!bin) {
    console.log('[AgentReach] agent-reach CLI not in PATH — using Node zero-config paths only');
    return;
  }
  const { ok, stdout } = await runCli(bin, ['doctor', '--json'], 12_000);
  if (!ok) {
    console.log('[AgentReach] agent-reach doctor unavailable/non-zero — continuing with Exa/yt-dlp');
    return;
  }
  try {
    const report = JSON.parse(stdout);
    const channels = report?.channels || report?.result?.channels || [];
    if (Array.isArray(channels)) {
      const okNames = channels
        .filter((c: any) => c?.status === 'ok' || c?.ok === true || c?.status === '✅')
        .map((c: any) => c.name || c.channel)
        .filter(Boolean);
      console.log(`[AgentReach] doctor OK channels: ${okNames.slice(0, 12).join(', ') || '(none listed)'}`);
    } else {
      console.log('[AgentReach] agent-reach CLI present (doctor JSON shape unrecognized)');
    }
  } catch {
    console.log('[AgentReach] agent-reach CLI present');
  }
}

/**
 * C) Reddit / X cookie paths — stub for optional owner sidecar.
 * FACT: Agent-Reach Reddit has no zero-config path (login required).
 * FACT: Twitter search needs TWITTER_AUTH_TOKEN + TWITTER_CT0 in process env.
 * JUDGMENT: Do not invent cookies on Render; skip until owner opts in.
 */
async function searchCookieSocialStubs(storeName: string): Promise<AgentReachResult[]> {
  const results: AgentReachResult[] = [];

  const hasTwitterCookies = !!(process.env.TWITTER_AUTH_TOKEN && process.env.TWITTER_CT0);
  const twitterBin = await resolveBin('twitter');
  if (twitterBin && hasTwitterCookies) {
    const { ok, stdout } = await runCli(twitterBin, [
      'search',
      `${storeName} promo code`,
      '-n',
      '8',
    ]);
    if (ok && stdout.trim()) {
      results.push({
        text: stdout.slice(0, 6000),
        url: '',
        source: 'Agent-Reach: twitter-cli (cookie session)',
      });
    }
  } else {
    console.log(
      '[AgentReach] Twitter/X stub: skipped (need twitter CLI + TWITTER_AUTH_TOKEN/TWITTER_CT0 — owner desktop/sidecar)',
    );
  }

  const opencliBin = await resolveBin('opencli');
  const rdtBin = await resolveBin('rdt');
  if (opencliBin) {
    const { ok, stdout } = await runCli(opencliBin, [
      'reddit',
      'search',
      `${storeName} promo code`,
      '-f',
      'yaml',
    ]);
    if (ok && stdout.trim()) {
      results.push({
        text: stdout.slice(0, 6000),
        url: '',
        source: 'Agent-Reach: opencli reddit (browser session)',
      });
    } else {
      console.log('[AgentReach] Reddit via opencli: no usable session — skipped (owner desktop login required)');
    }
  } else if (rdtBin) {
    const { ok, stdout } = await runCli(rdtBin, ['search', `${storeName} promo code`]);
    if (ok && stdout.trim()) {
      results.push({
        text: stdout.slice(0, 6000),
        url: '',
        source: 'Agent-Reach: rdt-cli (cookie session)',
      });
    } else {
      console.log('[AgentReach] Reddit via rdt-cli: skipped (cookie/login required)');
    }
  } else {
    console.log(
      '[AgentReach] Reddit stub: skipped (no opencli/rdt in PATH — optional sidecar; see DISCOVERY_WORK_TREE.md)',
    );
  }

  return results;
}

/**
 * Search social / semantic angles via Agent-Reach paths for a store.
 * Prefer Exa (zero-config) + yt-dlp when present; cookie platforms are optional.
 */
export async function searchViaAgentReach(
  storeName: string,
  _domain: string,
  region: string = 'GLOBAL',
): Promise<AgentReachResult[]> {
  if (!isEnabled()) {
    console.log('[AgentReach] Disabled via AGENT_REACH_ENABLED — skipping');
    return [];
  }

  console.log(`[AgentReach] Stage C/social+search angles for "${storeName}" (${region})...`);

  // Non-blocking capability probe
  await probeAgentReachDoctor().catch(() => undefined);

  const year = new Date().getFullYear();
  const exaQuery = `${storeName} promo code OR coupon OR discount ${region} ${year}`;

  const settled = await Promise.allSettled([
    searchExaMcp(exaQuery, 5),
    searchYoutubeViaYtDlp(storeName),
    searchCookieSocialStubs(storeName),
  ]);

  const results: AgentReachResult[] = [];
  for (const r of settled) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      results.push(...r.value);
    }
  }

  // Deduplicate by URL+text prefix
  const seen = new Set<string>();
  const deduped = results.filter(item => {
    const key = `${item.url}|${item.text.slice(0, 80)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`[AgentReach] Collected ${deduped.length} candidate texts (verify gate still required)`);
  return deduped;
}
