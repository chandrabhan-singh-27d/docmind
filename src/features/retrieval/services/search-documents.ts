import { generateSingleEmbedding } from '@/lib/embeddings/hf-embeddings';
import type { Result } from '@/lib/result';
import { ok } from '@/lib/result';
import type { AppError } from '@/lib/errors';
import { searchSimilarChunks } from '../repositories/vector-search-repo';
import type { RetrievedChunk } from '../types';

const MIN_SIMILARITY_THRESHOLD = 0.3;

/**
 * Embeds the user query, searches for similar chunks, and filters
 * by minimum similarity threshold to avoid low-quality results.
 */
export const searchDocuments = async (
  query: string,
  topK: number = 5,
): Promise<Result<ReadonlyArray<RetrievedChunk>, AppError>> => {
  // Step 1: Embed the query
  const embeddingResult = await generateSingleEmbedding(query);
  if (!embeddingResult.ok) return embeddingResult;

  // Step 2: Vector search
  const chunks = await searchSimilarChunks(embeddingResult.value, topK);

  // Step 3: Filter by similarity threshold
  const relevant = chunks.filter(
    (chunk) => chunk.similarity >= MIN_SIMILARITY_THRESHOLD,
  );

  if (relevant.length === 0) {
    return ok([]);
  }

  return ok(relevant);
};
