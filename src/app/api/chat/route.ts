import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { askQuestionStream } from '@/features/chat/services/ask-question-stream';
import { getClientKey, getDefaultRateLimiter } from '@/features/security/rate-limiter';
import { toErrorResponse, toHttpStatus } from '@/lib/errors';
import { withLogging } from '@/lib/logging/with-logging';

const ChatHistoryEntrySchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(4000),
});

const ChatRequestSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty').max(2000, 'Query too long'),
  topK: z.number().int().positive().max(10).optional(),
  documentId: z.string().uuid().optional(),
  history: z.array(ChatHistoryEntrySchema).max(20).optional(),
});

export const POST = withLogging(async (request: NextRequest) => {
  const limit = getDefaultRateLimiter().check(getClientKey(request));
  if (!limit.allowed) {
    const error = { type: 'RATE_LIMITED' as const, retryAfterMs: limit.retryAfterMs };
    return NextResponse.json(toErrorResponse(error), {
      status: toHttpStatus(error),
      headers: { 'Retry-After': Math.ceil(limit.retryAfterMs / 1000).toString() },
    });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    const error = {
      type: 'VALIDATION_ERROR' as const,
      message: 'Malformed JSON body',
    };

    return NextResponse.json(
      toErrorResponse(error),
      { status: toHttpStatus(error) },
    );
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    const error = {
      type: 'VALIDATION_ERROR' as const,
      message: z.prettifyError(parsed.error),
    };

    return NextResponse.json(
      toErrorResponse(error),
      { status: toHttpStatus(error) },
    );
  }

  const stream = await askQuestionStream({
    query: parsed.data.query,
    topK: parsed.data.topK,
    documentId: parsed.data.documentId,
    history: parsed.data.history,
    signal: request.signal,
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});
