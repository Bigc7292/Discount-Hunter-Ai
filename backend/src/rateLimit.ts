/**
 * Simple in-memory sliding-window rate limiter.
 * Per-IP (and optional per-userId) buckets for expensive routes.
 */

import type { Request, Response, NextFunction } from 'express';

interface WindowEntry {
  timestamps: number[];
}

const buckets = new Map<string, WindowEntry>();

function parseLimit(envKey: string, fallback: number): number {
  const raw = process.env[envKey];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function prune(entry: WindowEntry, windowMs: number, now: number): void {
  entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);
}

/**
 * Sliding window: allow `limit` requests per `windowMs` for a given key.
 * Returns { allowed, retryAfterSec }.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number = 60_000
): { allowed: boolean; retryAfterSec: number; remaining: number } {
  const now = Date.now();
  let entry = buckets.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    buckets.set(key, entry);
  }
  prune(entry, windowMs, now);

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return { allowed: false, retryAfterSec, remaining: 0 };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    retryAfterSec: 0,
    remaining: Math.max(0, limit - entry.timestamps.length),
  };
}

function clientIp(req: Request): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length > 0) {
    return xf.split(',')[0].trim();
  }
  if (Array.isArray(xf) && xf[0]) {
    return xf[0].split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function optionalUserId(req: Request): string | undefined {
  const header = req.headers['x-user-id'];
  if (typeof header === 'string' && header.trim()) return header.trim().slice(0, 128);
  const body = req.body as { userId?: unknown } | undefined;
  if (body && typeof body.userId === 'string' && body.userId.trim()) {
    return body.userId.trim().slice(0, 128);
  }
  return undefined;
}

export type RateLimitOptions = {
  /** Env var name for requests-per-minute (default RATE_LIMIT_VERIFY_PER_MIN) */
  envKey?: string;
  /** Fallback limit per minute */
  defaultPerMin?: number;
  /** Bucket prefix e.g. verify / discover */
  prefix: string;
};

/**
 * Express middleware — 429 + Retry-After when over limit.
 * Checks per-IP always; also checks per-userId when present (both must pass).
 */
export function rateLimitMiddleware(opts: RateLimitOptions) {
  const envKey = opts.envKey ?? 'RATE_LIMIT_VERIFY_PER_MIN';
  const defaultPerMin = opts.defaultPerMin ?? 10;
  const windowMs = 60_000;

  return (req: Request, res: Response, next: NextFunction) => {
    const limit = parseLimit(envKey, defaultPerMin);
    const ip = clientIp(req);
    const userId = optionalUserId(req);

    const ipCheck = checkRateLimit(`${opts.prefix}:ip:${ip}`, limit, windowMs);
    if (!ipCheck.allowed) {
      res.setHeader('Retry-After', String(ipCheck.retryAfterSec));
      res.setHeader('X-RateLimit-Limit', String(limit));
      res.setHeader('X-RateLimit-Remaining', '0');
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfterSec: ipCheck.retryAfterSec,
      });
    }

    if (userId) {
      const userLimit = parseLimit('RATE_LIMIT_USER_PER_MIN', limit);
      const userCheck = checkRateLimit(`${opts.prefix}:user:${userId}`, userLimit, windowMs);
      if (!userCheck.allowed) {
        res.setHeader('Retry-After', String(userCheck.retryAfterSec));
        res.setHeader('X-RateLimit-Limit', String(userLimit));
        res.setHeader('X-RateLimit-Remaining', '0');
        return res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfterSec: userCheck.retryAfterSec,
        });
      }
    }

    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(ipCheck.remaining));
    next();
  };
}

/** Test helper — clear all buckets */
export function resetRateLimitBuckets(): void {
  buckets.clear();
}
