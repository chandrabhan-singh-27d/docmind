import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/connection';
import { documents, chunks } from '@/lib/db/schema';
import type { Document, NewDocument, NewChunk } from '@/lib/db/schema';
import type { EmbeddedChunk } from '../types';

export const findDocumentByHash = async (
  contentHash: string,
): Promise<Document | undefined> => {
  const result = await db
    .select()
    .from(documents)
    .where(eq(documents.contentHash, contentHash))
    .limit(1);

  return result[0];
};

export const insertDocument = async (
  doc: NewDocument,
): Promise<Document> => {
  const result = await db
    .insert(documents)
    .values(doc)
    .returning();

  const inserted = result[0];
  if (!inserted) {
    throw new Error('Failed to insert document');
  }
  return inserted;
};

export const insertChunks = async (
  documentId: string,
  embeddedChunks: ReadonlyArray<EmbeddedChunk>,
): Promise<void> => {
  const chunkRecords: ReadonlyArray<NewChunk> = embeddedChunks.map(
    (chunk) => ({
      documentId,
      content: chunk.content,
      chunkIndex: chunk.index,
      tokenCount: chunk.tokenCount,
      contentHash: chunk.contentHash,
      embedding: chunk.embedding as number[],
    }),
  );

  await db.insert(chunks).values([...chunkRecords]);
};

export const updateDocumentChunkCount = async (
  documentId: string,
  totalChunks: number,
): Promise<void> => {
  await db
    .update(documents)
    .set({ totalChunks })
    .where(eq(documents.id, documentId));
};

export const deleteDocument = async (documentId: string): Promise<void> => {
  await db.delete(documents).where(eq(documents.id, documentId));
};

export const listDocuments = async (): Promise<ReadonlyArray<Document>> =>
  db.select().from(documents).orderBy(documents.createdAt);
