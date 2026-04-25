import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateUpload } from '@/features/security/validate-upload';
import { ingestDocument } from '@/features/ingestion/services/ingest-document';
import { listDocuments, deleteDocument } from '@/features/ingestion/repositories/document-repo';
import { toHttpStatus, toErrorResponse } from '@/lib/errors';

const MAX_UPLOAD_SIZE_MB = Number(process.env['MAX_UPLOAD_SIZE_MB'] ?? 20);

export async function POST(request: NextRequest) {
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
}

export async function GET() {
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
}

export async function DELETE(request: NextRequest) {
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
}
