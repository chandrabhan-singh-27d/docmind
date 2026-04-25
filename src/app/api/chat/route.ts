import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod/v4';
import { askQuestion } from '@/features/chat/services/ask-question';
import { toHttpStatus, toErrorResponse } from '@/lib/errors';

const ChatRequestSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty').max(2000, 'Query too long'),
  topK: z.number().int().positive().max(10).optional(),
});

export async function POST(request: NextRequest) {
  const body: unknown = await request.json();

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          type: 'VALIDATION_ERROR',
          message: z.prettifyError(parsed.error),
        },
      },
      { status: 422 },
    );
  }

  const result = await askQuestion({
    query: parsed.data.query,
    topK: parsed.data.topK,
  });

  if (!result.ok) {
    return NextResponse.json(
      toErrorResponse(result.error),
      { status: toHttpStatus(result.error) },
    );
  }

  return NextResponse.json(result.value);
}
