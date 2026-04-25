import { generateEmbeddings } from '@/lib/embeddings/hf-embeddings';
import type { Result } from '@/lib/result';
import { ok, err } from '@/lib/result';
import type { AppError } from '@/lib/errors';
import type { TextChunk, EmbeddedChunk } from '../types';

const BATCH_SIZE = 32;

/**
 * Embeds chunks in batches to respect API limits.
 * Each batch sends up to BATCH_SIZE texts in a single API call.
 */
export const embedChunks = async (
  chunks: ReadonlyArray<TextChunk>,
): Promise<Result<ReadonlyArray<EmbeddedChunk>, AppError>> => {
  const embeddedChunks: EmbeddedChunk[] = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map((chunk) => chunk.content);

    const result = await generateEmbeddings({ texts });

    if (!result.ok) {
      return err(result.error);
    }

    if (result.value.length !== batch.length) {
      return err({
        type: 'EMBEDDING_FAILED',
        reason: `Expected ${batch.length} embeddings, got ${result.value.length}`,
      });
    }

    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j];
      const embedding = result.value[j];
      if (!chunk || !embedding) {
        return err({
          type: 'EMBEDDING_FAILED',
          reason: `Missing chunk or embedding at index ${j}`,
        });
      }
      embeddedChunks.push({ ...chunk, embedding });
    }
  }

  return ok(embeddedChunks);
};
