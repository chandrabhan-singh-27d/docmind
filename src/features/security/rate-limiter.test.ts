import { describe, it, expect } from 'vitest';
import { createRateLimiter } from './rate-limiter';

describe('createRateLimiter', () => {
  it('allows requests up to the burst capacity', () => {
    const now = 0;
    const limiter = createRateLimiter({ rpm: 60, now: () => now });
    for (let i = 0; i < 60; i += 1) {
      expect(limiter.check('ip').allowed).toBe(true);
    }
    expect(limiter.check('ip').allowed).toBe(false);
  });

  it('refills tokens over time', () => {
    let now = 0;
    const limiter = createRateLimiter({ rpm: 60, burst: 1, now: () => now });
    expect(limiter.check('ip').allowed).toBe(true);
    expect(limiter.check('ip').allowed).toBe(false);
    now += 1_000; // 1 token regenerated at 1/sec
    expect(limiter.check('ip').allowed).toBe(true);
  });

  it('returns a positive retryAfterMs when blocked', () => {
    const now = 0;
    const limiter = createRateLimiter({ rpm: 60, burst: 1, now: () => now });
    limiter.check('ip');
    const blocked = limiter.check('ip');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('isolates buckets per key', () => {
    const now = 0;
    const limiter = createRateLimiter({ rpm: 60, burst: 1, now: () => now });
    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(false);
    expect(limiter.check('b').allowed).toBe(true);
  });
});
