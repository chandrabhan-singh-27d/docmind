'use client';

import { useEffect } from 'react';
import { logClientEvent } from '@/lib/logging/client-logger';

/**
 * Catches errors that escape `app/layout.tsx` itself — e.g. a thrown
 * font import, a broken theme bootstrap, or a layout-level component
 * that crashes during render. Because the root layout has failed, this
 * file must render its own <html> and <body>; Next.js renders this in
 * place of the entire tree.
 */
export default function GlobalError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    logClientEvent({
      level: 'error',
      message: `[layout] ${error.message}`,
      stack: error.stack,
      context: error.digest ? { digest: error.digest, fatal: true } : { fatal: true },
    });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
          Something went wrong loading the app.
        </h1>
        <p style={{ color: '#666', marginBottom: '1rem' }}>
          A fatal error happened in the root layout. The error has been logged.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            cursor: 'pointer',
            padding: '0.5rem 1rem',
            border: '1px solid #ccc',
            borderRadius: '0.5rem',
            background: 'white',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
