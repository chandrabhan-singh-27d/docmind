import type { Result } from '@/lib/result';
import { ok, err } from '@/lib/result';
import type { AppError } from '@/lib/errors';
import type { Document } from '@/lib/db/schema';
import { parseDocument } from './parse-document';
import { chunkText } from './chunk-text';
import { embedChunks } from './embed-chunks';
import {
  findDocumentByHash,
  insertDocument,
  insertChunks,
  updateDocumentChunkCount,
} from '../repositories/document-repo';

interface IngestParams {
  readonly buffer: Buffer;
  readonly filename: string;
  readonly mimeType: string;
}

/**
 * Full ingestion pipeline: parse → chunk → embed → store.
 * Idempotent — if content hash already exists, returns existing document.
 */
export const ingestDocument = async (
  params: IngestParams,
): Promise<Result<Document, AppError>> => {
  // Step 1: Parse
  const parsed = await parseDocument(
    params.buffer,
    params.filename,
    params.mimeType,
  );
  if (!parsed.ok) return parsed;

  // Step 2: Dedup check — same content already uploaded?
  const existing = await findDocumentByHash(parsed.value.contentHash);
  if (existing) return ok(existing);

  // Step 3: Chunk
  const chunked = chunkText(parsed.value.content);
  if (!chunked.ok) return chunked;

  // Step 4: Embed
  const embedded = await embedChunks(chunked.value);
  if (!embedded.ok) return embedded;

  // Step 5: Store document
  try {
    const document = await insertDocument({
      filename: parsed.value.filename,
      mimeType: parsed.value.mimeType,
      sizeBytes: parsed.value.sizeBytes,
      contentHash: parsed.value.contentHash,
      totalChunks: embedded.value.length,
    });

    // Step 6: Store chunks with embeddings
    await insertChunks(document.id, embedded.value);
    await updateDocumentChunkCount(document.id, embedded.value.length);

    return ok(document);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Database operation failed';
    return err({ type: 'DATABASE_ERROR', reason: message });
  }
};
