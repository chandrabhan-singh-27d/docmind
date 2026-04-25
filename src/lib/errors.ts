/**
 * Discriminated union for all application errors.
 * Every error is handleable by type — no generic catch-all.
 */

export type AppError =
  | { readonly type: 'VALIDATION_ERROR'; readonly message: string; readonly field?: string }
  | { readonly type: 'FILE_TOO_LARGE'; readonly maxMb: number; readonly actualMb: number }
  | { readonly type: 'UNSUPPORTED_FILE_TYPE'; readonly mimeType: string }
  | { readonly type: 'DOCUMENT_NOT_FOUND'; readonly documentId: string }
  | { readonly type: 'EMBEDDING_FAILED'; readonly reason: string }
  | { readonly type: 'LLM_ERROR'; readonly reason: string }
  | { readonly type: 'LLM_RATE_LIMITED'; readonly retryAfterMs: number }
  | { readonly type: 'DATABASE_ERROR'; readonly reason: string }
  | { readonly type: 'CHUNK_LIMIT_EXCEEDED'; readonly max: number }
  | { readonly type: 'PROMPT_INJECTION_DETECTED' };

export const toHttpStatus = (error: AppError): number => {
  switch (error.type) {
    case 'VALIDATION_ERROR':
    case 'FILE_TOO_LARGE':
    case 'UNSUPPORTED_FILE_TYPE':
    case 'CHUNK_LIMIT_EXCEEDED':
      return 422;
    case 'DOCUMENT_NOT_FOUND':
      return 404;
    case 'PROMPT_INJECTION_DETECTED':
      return 400;
    case 'LLM_RATE_LIMITED':
      return 429;
    case 'EMBEDDING_FAILED':
    case 'LLM_ERROR':
    case 'DATABASE_ERROR':
      return 500;
  }
};

export const toErrorResponse = (error: AppError) => ({
  error: {
    type: error.type,
    message: formatErrorMessage(error),
  },
});

const formatErrorMessage = (error: AppError): string => {
  switch (error.type) {
    case 'VALIDATION_ERROR':
      return error.field
        ? `Validation failed on field "${error.field}": ${error.message}`
        : error.message;
    case 'FILE_TOO_LARGE':
      return `File size (${error.actualMb}MB) exceeds maximum (${error.maxMb}MB)`;
    case 'UNSUPPORTED_FILE_TYPE':
      return `File type "${error.mimeType}" is not supported. Use PDF, MD, or TXT.`;
    case 'DOCUMENT_NOT_FOUND':
      return `Document "${error.documentId}" not found`;
    case 'EMBEDDING_FAILED':
      return 'Failed to generate embeddings. Please try again.';
    case 'LLM_ERROR':
      return 'AI service temporarily unavailable. Please try again.';
    case 'LLM_RATE_LIMITED':
      return 'Rate limit reached. Please wait before trying again.';
    case 'DATABASE_ERROR':
      return 'Internal error. Please try again.';
    case 'CHUNK_LIMIT_EXCEEDED':
      return `Document exceeds maximum chunk limit (${error.max})`;
    case 'PROMPT_INJECTION_DETECTED':
      return 'Invalid query detected.';
  }
};
