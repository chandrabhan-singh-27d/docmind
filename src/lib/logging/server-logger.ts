import { db } from '@/lib/db/connection';
import { errorEvents } from '@/lib/db/schema';
import type { LogEventInput, LogSource } from './types';
import { redactContext, redactMessage, redactStack } from './redact';

interface ServerLogEnvelope extends LogEventInput {
  readonly source: LogSource;
  readonly requestId?: string;
  readonly userAgent?: string;
  readonly releaseId?: string;
}

/**
 * Insert a redacted log event into Postgres. **Never throws** — logging is
 * best-effort and must not take down a request handler that's already in
 * an error path. Failures fall through to a console.error so they're not
 * completely invisible.
 */
export const logEvent = async (envelope: ServerLogEnvelope): Promise<void> => {
  try {
    await db.insert(errorEvents).values({
      level: envelope.level,
      source: envelope.source,
      message: redactMessage(envelope.message),
      stack: redactStack(envelope.stack),
      route: envelope.route,
      requestId: envelope.requestId,
      userAgent: envelope.userAgent,
      url: envelope.url,
      releaseId: envelope.releaseId ?? process.env['RELEASE_ID'],
      context: redactContext(envelope.context),
    });
  } catch (err) {
    // Logging must not propagate — fall back to stderr so ops can still see
    // that the pipeline is broken.
    console.error('[logEvent] failed to persist error event', {
      level: envelope.level,
      source: envelope.source,
      reason: err instanceof Error ? err.message : 'unknown',
    });
  }
};


