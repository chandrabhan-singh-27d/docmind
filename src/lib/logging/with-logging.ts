import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logBackendError } from './server-logger';

type RouteHandler = (request: NextRequest) => Promise<Response>;

/**
 * Wrap a route handler with a top-level catch that records unhandled
 * throws to error_events. Already-handled `AppError` results don't reach
 * this wrapper — they go through the typed error response path. This
 * catches the *unexpected* throws (uncaught DB drops, native binding
 * crashes, etc.).
 *
 * The wrapped handler still returns the same 500 it would have returned
 * had the throw bubbled to Next — we just leave a breadcrumb on the way.
 */
export const withLogging = (handler: RouteHandler): RouteHandler =>
  async (request) => {
    try {
      return await handler(request);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      const url = new URL(request.url);
      void logBackendError(error.message, {
        stack: error.stack,
        route: url.pathname,
        requestId: request.headers.get('x-request-id') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
        context: { method: request.method },
      });
      return NextResponse.json(
        { error: { type: 'INTERNAL_ERROR', message: 'Internal server error.' } },
        { status: 500 },
      );
    }
  };
