import { describe, it, expect } from 'vitest';
import { createLruCache } from './lru-cache';

describe('createLruCache', () => {
  it('returns undefined for missing keys', () => {
    const cache = createLruCache<number>({ maxEntries: 3, ttlMs: 1000 });
    expect(cache.get('nope')).toBeUndefined();
  });

  it('stores and retrieves values', () => {
    const cache = createLruCache<string>({ maxEntries: 3, ttlMs: 1000 });
    cache.set('a', 'alpha');
    expect(cache.get('a')).toBe('alpha');
  });

  it('evicts the least recently used entry past capacity', () => {
    const cache = createLruCache<number>({ maxEntries: 2, ttlMs: 1000 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a'); // a becomes most recently used
    cache.set('c', 3); // should evict b
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe(3);
  });

  it('expires entries after ttl', () => {
    let now = 1_000;
    const cache = createLruCache<number>({
      maxEntries: 3,
      ttlMs: 100,
      now: () => now,
    });
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
    now += 200;
    expect(cache.get('a')).toBeUndefined();
  });

  it('updates value and refreshes ttl on re-set', () => {
    let now = 1_000;
    const cache = createLruCache<number>({
      maxEntries: 3,
      ttlMs: 100,
      now: () => now,
    });
    cache.set('a', 1);
    now += 80;
    cache.set('a', 2);
    now += 80;
    expect(cache.get('a')).toBe(2);
  });
});
