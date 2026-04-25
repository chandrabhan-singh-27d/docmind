import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/connection';
import { chunks, documents } from '@/lib/db/schema';
import type { RetrievedChunk } from '../types';

/**
 * Performs cosine similarity search against stored chunk embeddings.
 * Returns top-K most similar chunks with their source document filename.
 */
export const searchSimilarChunks = async (
  queryEmbedding: ReadonlyArray<number>,
  topK: number = 5,
): Promise<ReadonlyArray<RetrievedChunk>> => {
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  const results = await db
    .select({
      id: chunks.id,
      documentId: chunks.documentId,
      content: chunks.content,
      chunkIndex: chunks.chunkIndex,
      similarity: sql<number>`1 - (${chunks.embedding} <=> ${embeddingStr}::vector)`,
      filename: documents.filename,
    })
    .from(chunks)
    .innerJoin(documents, sql`${chunks.documentId} = ${documents.id}`)
    .orderBy(sql`${chunks.embedding} <=> ${embeddingStr}::vector`)
    .limit(topK);

  return results;
};
