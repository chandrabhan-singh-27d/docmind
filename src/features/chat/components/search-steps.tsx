'use client';

import { useState } from 'react';
import type { SearchStep } from '../types';

export default function SearchSteps({
  steps,
  isStreaming,
}: {
  readonly steps: ReadonlyArray<SearchStep>;
  readonly isStreaming: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (steps.length === 0) return null;

  return (
    <div className="border-t border-zinc-200 pt-3 dark:border-zinc-700">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex cursor-pointer items-center gap-1 text-sm font-semibold text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        <span>{open ? '▾' : '▸'}</span>
        <span>How I searched ({steps.length})</span>
        {isStreaming && (
          <span className="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
        )}
      </button>
      {open && (
        <ol className="mt-2 space-y-1 border-l-2 border-zinc-200 pl-3 dark:border-zinc-800">
          {steps.map((step) => (
            <li key={step.id} className="text-sm text-zinc-600 dark:text-zinc-400">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {step.label}
              </span>
              {step.detail && (
                <span className="ml-1 text-zinc-500 dark:text-zinc-500">
                  — {step.detail}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
