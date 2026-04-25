import type { Result } from '@/lib/result';
import { ok, err } from '@/lib/result';
import type { AppError } from '@/lib/errors';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
] as const;

type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46] as const; // %PDF

interface UploadValidation {
  readonly filename: string;
  readonly mimeType: AllowedMimeType;
  readonly sizeBytes: number;
  readonly buffer: Buffer;
}

const isAllowedMimeType = (type: string): type is AllowedMimeType =>
  (ALLOWED_MIME_TYPES as ReadonlyArray<string>).includes(type);

const sanitizeFilename = (filename: string): string =>
  filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .slice(0, 255);

const validateMagicBytes = (
  buffer: Buffer,
  mimeType: AllowedMimeType,
): boolean => {
  if (mimeType === 'application/pdf') {
    return PDF_MAGIC_BYTES.every((byte, i) => buffer[i] === byte);
  }
  return true;
};

export const validateUpload = (
  file: File,
  buffer: Buffer,
  maxSizeMb: number,
): Result<UploadValidation, AppError> => {
  const maxBytes = maxSizeMb * 1024 * 1024;

  if (file.size > maxBytes) {
    return err({
      type: 'FILE_TOO_LARGE',
      maxMb: maxSizeMb,
      actualMb: Math.round((file.size / (1024 * 1024)) * 100) / 100,
    });
  }

  if (!isAllowedMimeType(file.type)) {
    return err({
      type: 'UNSUPPORTED_FILE_TYPE',
      mimeType: file.type || 'unknown',
    });
  }

  if (!validateMagicBytes(buffer, file.type)) {
    return err({
      type: 'UNSUPPORTED_FILE_TYPE',
      mimeType: `${file.type} (magic bytes mismatch)`,
    });
  }

  return ok({
    filename: sanitizeFilename(file.name),
    mimeType: file.type,
    sizeBytes: file.size,
    buffer,
  });
};
