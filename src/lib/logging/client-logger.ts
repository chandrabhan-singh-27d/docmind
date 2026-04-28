'use client';

import type { LogEventInput } from './types';

const ENDPOINT = '/api/logs/event';

/**
 * Browser-side logger. POSTs an event to /api/logs/event. Failures are
 * intentionally swallowed — the user must never see the page break because
 * we couldn't log a previous error.
 *
 * Uses sendBeacon when available (page-unload safe), otherwise falls back
 * to a fire-and-forget fetch with keepalive.
 */
export const logClientEvent = (event: LogEventInput): void => {
  if (typeof window === 'undefined') return;

  const body = JSON.stringify({
    level: event.level,
    message: event.message,
    stack: event.stack,
    url: event.url ?? window.location.href,
    context: event.context,
  });

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      const ok = navigator.sendBeacon(ENDPOINT, blob);
      if (ok) return;
    }
  } catch {
    // sendBeacon may throw on some browsers; fall through to fetch.
  }

  void fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    // Swallow — logging must never block UX.
  });
};
