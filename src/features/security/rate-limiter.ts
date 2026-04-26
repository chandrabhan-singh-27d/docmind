import type { NextRequest } from 'next/server';
import { getEnv } from '@/config/env';

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly retryAfterMs: number;
}

export interface RateLimiterOptions {
  readonly rpm: number;
  readonly burst?: number;
  readonly maxKeys?: number;
  readonly now?: () => number;
}

export interface RateLimiter {
  check: (key: string) => RateLimitResult;
}

const DEFAULT_MAX_KEYS = 10_000;

/**
 * In-memory token-bucket limiter. Tokens refill continuously at rpm/60 per
 * second; bucket capacity is `burst` (defaults to rpm). Per-key buckets are
 * stored in a Map; when it grows past maxKeys, the oldest entry is evicted.
 *
 * Single-process only — for multi-replica deployments back this with Redis.
 */
export const createRateLimiter = (options: RateLimiterOptions): RateLimiter => {
  const capacity = options.burst ?? options.rpm;
  const refillPerMs = options.rpm / 60_000;
  const maxKeys = options.maxKeys ?? DEFAULT_MAX_KEYS;
  const now = options.now ?? Date.now;
  const buckets = new Map<string, Bucket>();

  const check = (key: string): RateLimitResult => {
    const t = now();
    let bucket = buckets.get(key);

    if (!bucket) {
      bucket = { tokens: capacity, lastRefill: t };
    } else {
      buckets.delete(key);
      const elapsed = t - bucket.lastRefill;
      bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * refillPerMs);
      bucket.lastRefill = t;
    }

    let allowed: boolean;
    let retryAfterMs: number;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      allowed = true;
      retryAfterMs = 0;
    } else {
      allowed = false;
      retryAfterMs = Math.ceil((1 - bucket.tokens) / refillPerMs);
    }

    buckets.set(key, bucket);

    while (buckets.size > maxKeys) {
      const oldest = buckets.keys().next().value;
      if (oldest === undefined) break;
      buckets.delete(oldest);
    }

    return { allowed, retryAfterMs };
  };

  return { check };
};

export const getClientKey = (request: NextRequest): string => {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'anonymous';
};

let sharedLimiter: RateLimiter | null = null;

export const getDefaultRateLimiter = (): RateLimiter => {
  if (!sharedLimiter) {
    const rpm = getEnv().RATE_LIMIT_RPM;
    sharedLimiter = createRateLimiter({ rpm });
  }
  return sharedLimiter;
};
