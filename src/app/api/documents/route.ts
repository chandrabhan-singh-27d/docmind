import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateUpload } from '@/features/security/validate-upload';
import { ingestDocument } from '@/features/ingestion/services/ingest-document';
import { listDocuments, deleteDocument } from '@/features/ingestion/repositories/document-repo';
import { getClientKey, getDefaultRateLimiter } from '@/features/security/rate-limiter';
import { toHttpStatus, toErrorResponse } from '@/lib/errors';
import { withLogging } from '@/lib/logging/with-logging';

const rateLimitResponse = (request: NextRequest): NextResponse | null => {
  const limit = getDefaultRateLimiter().check(getClientKey(request));
  if (limit.allowed) return null;
  const error = { type: 'RATE_LIMITED' as const, retryAfterMs: limit.retryAfterMs };
  return NextResponse.json(toErrorResponse(error), {
    status: toHttpStatus(error),
    headers: { 'Retry-After': Math.ceil(limit.retryAfterMs / 1000).toString() },
  });
};

const MAX_UPLOAD_SIZE_MB = Number(process.env['MAX_UPLOAD_SIZE_MB'] ?? 20);

export const POST = withLogging(async (request: NextRequest) => {
  const limited = rateLimitResponse(request);
  if (limited) return limited;

  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: { type: 'VALIDATION_ERROR', message: 'No file provided' } },
      { status: 422 },
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Validate upload (MIME, size, magic bytes)
  const validation = validateUpload(file, buffer, MAX_UPLOAD_SIZE_MB);
  if (!validation.ok) {
    return NextResponse.json(
      toErrorResponse(validation.error),
      { status: toHttpStatus(validation.error) },
    );
  }

  // Run ingestion pipeline
  const result = await ingestDocument({
    buffer,
    filename: validation.value.filename,
    mimeType: validation.value.mimeType,
  });

  if (!result.ok) {
    return NextResponse.json(
      toErrorResponse(result.error),
      { status: toHttpStatus(result.error) },
    );
  }

  return NextResponse.json(
    {
      document: {
        id: result.value.id,
        filename: result.value.filename,
        totalChunks: result.value.totalChunks,
        createdAt: result.value.createdAt,
      },
    },
    { status: 201 },
  );
});

export const GET = withLogging(async () => {
  const docs = await listDocuments();

  return NextResponse.json({
    documents: docs.map((doc) => ({
      id: doc.id,
      filename: doc.filename,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      totalChunks: doc.totalChunks,
      createdAt: doc.createdAt,
    })),
  });
});

export const DELETE = withLogging(async (request: NextRequest) => {
  const limited = rateLimitResponse(request);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('id');

  if (!documentId) {
    return NextResponse.json(
      { error: { type: 'VALIDATION_ERROR', message: 'Document ID required' } },
      { status: 422 },
    );
  }

  await deleteDocument(documentId);
  return NextResponse.json({ deleted: true });
});
