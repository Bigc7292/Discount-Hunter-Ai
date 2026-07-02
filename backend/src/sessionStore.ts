/**
 * Session Store – in-memory cache for discovery results.
 * Provides create, get, delete and periodic cleanup functions.
 */
import { randomUUID } from 'crypto';

export interface SessionData {
  id: string;
  payload: any; // discovery result
  createdAt: number;
  expiresAt: number;
}

const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS) || 30 * 60 * 1000; // default 30 min

// In‑memory map of sessions
const sessions = new Map<string, SessionData>();

/** Create a new session and store payload */
export function createSession(payload: any): string {
  const id = randomUUID();
  const now = Date.now();
  const session: SessionData = {
    id,
    payload,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
  sessions.set(id, session);
  return id;
}

/** Retrieve a session by id (returns undefined if missing or expired) */
export function getSession(id: string): any | undefined {
  const session = sessions.get(id);
  if (!session) return undefined;
  if (session.expiresAt < Date.now()) {
    sessions.delete(id);
    return undefined;
  }
  return session.payload;
}

/** Delete a session explicitly */
export function deleteSession(id: string): void {
  sessions.delete(id);
}

/** Cleanup expired sessions – can be scheduled via cron */
export function cleanupExpired(): void {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (session.expiresAt < now) {
      sessions.delete(id);
    }
  }
}

export { SESSION_TTL_MS };
