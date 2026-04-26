import { generateSingleEmbedding } from '@/lib/embeddings/hf-embeddings';
import type { Result } from '@/lib/result';
import { ok } from '@/lib/result';
import type { AppError } from '@/lib/errors';
import { createLruCache } from '@/lib/cache/lru-cache';
import { getEnv } from '@/config/env';
import { searchSimilarChunks } from '../repositories/vector-search-repo';
import type { RetrievedChunk } from '../types';

const MIN_SIMILARITY_THRESHOLD = 0.3;
const CACHE_MAX_ENTRIES = 256;
const CACHE_TTL_MS = 60 * 60 * 1000;

const embeddingCache = createLruCache<ReadonlyArray<number>>({
  maxEntries: CACHE_MAX_ENTRIES,
  ttlMs: CACHE_TTL_MS,
});

const normalizeQuery = (query: string): string =>
  query.trim().toLowerCase().replace(/\s+/g, ' ');

const cacheKey = (query: string, model: string): string =>
  `${model}::${normalizeQuery(query)}`;

export const __embeddingCacheForTests = embeddingCache;

/**
 * Embeds the user query, searches for similar chunks, and filters
 * by minimum similarity threshold to avoid low-quality results.
 *
 * Query embeddings are cached (LRU + TTL) keyed by normalized query +
 * embedding model, so repeated questions skip the HF round-trip.
 */
export const searchDocuments = async (
  query: string,
  topK: number = 5,
): Promise<Result<ReadonlyArray<RetrievedChunk>, AppError>> => {
  const model = getEnv().EMBEDDING_MODEL;
  const key = cacheKey(query, model);

  let embedding = embeddingCache.get(key);
  if (!embedding) {
    const embeddingResult = await generateSingleEmbedding(query, model);
    if (!embeddingResult.ok) return embeddingResult;
    embedding = embeddingResult.value;
    embeddingCache.set(key, embedding);
  }

  const chunks = await searchSimilarChunks(embedding, topK);

  const relevant = chunks.filter(
    (chunk) => chunk.similarity >= MIN_SIMILARITY_THRESHOLD,
  );

  if (relevant.length === 0) {
    return ok([]);
  }

  return ok(relevant);
};
