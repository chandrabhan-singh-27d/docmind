interface Entry<V> {
  readonly value: V;
  readonly expiresAt: number;
}

export interface LruCache<V> {
  get: (key: string) => V | undefined;
  set: (key: string, value: V) => void;
  readonly size: number;
  clear: () => void;
}

export interface LruCacheOptions {
  readonly maxEntries: number;
  readonly ttlMs: number;
  readonly now?: () => number;
}

/**
 * In-memory LRU cache with per-entry TTL. Map preserves insertion order,
 * so a re-set on access keeps the hot key at the tail and cheapens eviction.
 */
export const createLruCache = <V>(options: LruCacheOptions): LruCache<V> => {
  const { maxEntries, ttlMs } = options;
  const now = options.now ?? Date.now;
  const store = new Map<string, Entry<V>>();

  const get = (key: string): V | undefined => {
    const entry = store.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt <= now()) {
      store.delete(key);
      return undefined;
    }

    store.delete(key);
    store.set(key, entry);
    return entry.value;
  };

  const set = (key: string, value: V): void => {
    if (store.has(key)) store.delete(key);
    store.set(key, { value, expiresAt: now() + ttlMs });

    while (store.size > maxEntries) {
      const oldest = store.keys().next().value;
      if (oldest === undefined) break;
      store.delete(oldest);
    }
  };

  return {
    get,
    set,
    clear: () => store.clear(),
    get size() {
      return store.size;
    },
  };
};
