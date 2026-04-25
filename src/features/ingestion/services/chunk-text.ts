import { createHash } from 'crypto';
import type { Result } from '@/lib/result';
import { ok, err } from '@/lib/result';
import type { AppError } from '@/lib/errors';
import type { TextChunk, ChunkingConfig } from '../types';
import { DEFAULT_CHUNKING_CONFIG } from '../types';

/**
 * Rough token estimation: ~4 characters per token (English text).
 * Good enough for chunking decisions — exact count not needed here.
 */
const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

const computeHash = (content: string): string =>
  createHash('sha256').update(content).digest('hex');

/**
 * Splits text on sentence boundaries first, then falls back
 * to word boundaries. Preserves semantic coherence within chunks.
 */
const splitIntoSentences = (text: string): ReadonlyArray<string> =>
  text.match(/[^.!?\n]+[.!?\n]?\s*/g) ?? [text];

export const chunkText = (
  text: string,
  config: ChunkingConfig = DEFAULT_CHUNKING_CONFIG,
): Result<ReadonlyArray<TextChunk>, AppError> => {
  const sentences = splitIntoSentences(text);
  const chunks: TextChunk[] = [];
  const appendChunk = (content: string): Result<void, AppError> => {
    chunks.push({
      content,
      index: chunks.length,
      tokenCount: estimateTokens(content),
      contentHash: computeHash(content),
    });

    if (chunks.length > config.maxChunks) {
      return err({
        type: 'CHUNK_LIMIT_EXCEEDED',
        max: config.maxChunks,
      });
    }

    return ok(undefined);
  };

  let currentChunk = '';
  let overlapBuffer = '';

  for (const sentence of sentences) {
    const wouldBeSize = estimateTokens(currentChunk + sentence);

    if (wouldBeSize > config.chunkSize && currentChunk.length > 0) {
      const trimmed = currentChunk.trim();
      const appendResult = appendChunk(trimmed);
      if (!appendResult.ok) {
        return appendResult;
      }

      // Build overlap from the end of the current chunk
      const words = trimmed.split(/\s+/);
      const overlapWordCount = Math.ceil(
        (config.chunkOverlap / config.chunkSize) * words.length,
      );
      overlapBuffer = words.slice(-overlapWordCount).join(' ');

      currentChunk = overlapBuffer + ' ' + sentence;
    } else {
      currentChunk += sentence;
    }
  }

  // Final chunk
  if (currentChunk.trim().length > 0) {
    const trimmed = currentChunk.trim();
    const appendResult = appendChunk(trimmed);
    if (!appendResult.ok) {
      return appendResult;
    }
  }

  return ok(chunks);
};
