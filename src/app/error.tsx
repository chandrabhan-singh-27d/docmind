'use client';

import { useEffect } from 'react';
import { logClientEvent } from '@/lib/logging/client-logger';

/**
 * Catches React render errors in any segment below the root layout.
 * Next.js auto-wraps this around `children` in `app/layout.tsx`, so it
 * replaces the manual class-based boundary. The matching reset() prop
 * lets the user retry the failed segment without a full page reload.
 *
 * Errors that originate *in* the root layout itself (font load failure,
 * head script throw, etc.) are caught by `global-error.tsx` instead.
 */
export default function Error({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    logClientEvent({
      level: 'error',
      message: error.message,
      stack: error.stack,
      context: error.digest ? { digest: error.digest } : undefined,
    });
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-base font-medium">Something went wrong rendering this page.</p>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        The error has been logged. You can try again without reloading.
      </p>
      <button
        type="button"
        onClick={reset}
        className="cursor-pointer rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
      >
        Try again
      </button>
    </div>
  );
}
