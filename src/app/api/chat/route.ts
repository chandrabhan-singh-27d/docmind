import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { askQuestionStream } from '@/features/chat/services/ask-question-stream';
import { toErrorResponse, toHttpStatus } from '@/lib/errors';

const ChatRequestSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty').max(2000, 'Query too long'),
  topK: z.number().int().positive().max(10).optional(),
});

export async function POST(request: NextRequest) {
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
    signal: request.signal,
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
