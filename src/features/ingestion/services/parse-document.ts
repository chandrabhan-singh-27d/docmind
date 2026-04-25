import { createHash } from 'crypto';
import { PDFParse } from 'pdf-parse';
import type { Result } from '@/lib/result';
import { ok, err } from '@/lib/result';
import type { AppError } from '@/lib/errors';
import type { ParsedDocument } from '../types';

const parsePdf = async (buffer: Buffer): Promise<string> => {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  return result.text;
};

const parseText = (buffer: Buffer): string => buffer.toString('utf-8');

const computeHash = (content: string): string =>
  createHash('sha256').update(content).digest('hex');

export const parseDocument = async (
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<Result<ParsedDocument, AppError>> => {
  try {
    const content =
      mimeType === 'application/pdf'
        ? await parsePdf(buffer)
        : parseText(buffer);

    const trimmed = content.trim();

    if (trimmed.length === 0) {
      return err({
        type: 'VALIDATION_ERROR',
        message: 'Document has no extractable text content',
      });
    }

    return ok({
      content: trimmed,
      filename,
      mimeType,
      sizeBytes: buffer.length,
      contentHash: computeHash(trimmed),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to parse document';
    return err({ type: 'VALIDATION_ERROR', message });
  }
};
