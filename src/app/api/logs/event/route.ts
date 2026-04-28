import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { getClientKey, getDefaultRateLimiter } from '@/features/security/rate-limiter';
import { logEvent } from '@/lib/logging/server-logger';

const ClientLogSchema = z.object({
  level: z.enum(['error', 'warn', 'info']),
  message: z.string().min(1).max(8000),
  stack: z.string().max(16000).optional(),
  url: z.string().max(2000).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

const NO_CONTENT = new NextResponse(null, { status: 204 });
const RATE_LIMITED = NextResponse.json(
  { error: { type: 'RATE_LIMITED', message: 'Too many log events.' } },
  { status: 429 },
);

/**
 * Frontend-only logging endpoint. The backend writes to Postgres directly
 * via logEvent(); this route is purely the client transport.
 *
 * Behavior:
 *   - Rate-limited via the existing limiter so a buggy frontend can't
 *     fill the table.
 *   - Returns 204 on success.
 *   - Always returns 204 on parse/persist failures too, so a misbehaving
 *     client doesn't get a feedback loop telling it "the log endpoint
 *     itself is broken". Failures surface server-side via console.error.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const limit = getDefaultRateLimiter().check(getClientKey(request));
  if (!limit.allowed) return RATE_LIMITED;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NO_CONTENT;
  }

  const parsed = ClientLogSchema.safeParse(raw);
  if (!parsed.success) return NO_CONTENT;

  await logEvent({
    level: parsed.data.level,
    source: 'frontend',
    message: parsed.data.message,
    stack: parsed.data.stack,
    url: parsed.data.url,
    context: parsed.data.context,
    userAgent: request.headers.get('user-agent') ?? undefined,
    requestId: request.headers.get('x-request-id') ?? undefined,
  });

  return NO_CONTENT;
}
