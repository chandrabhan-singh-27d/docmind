'use client';

import type { Citation } from '@/features/retrieval/types';

export default function CitationCard({
  citation,
  index,
}: {
  readonly citation: Citation;
  readonly index: number;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
          {index + 1}
        </span>
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {citation.filename}
        </span>
        <span className="text-xs text-zinc-400">
          {(citation.relevance * 100).toFixed(0)}% relevant
        </span>
      </div>
      <p className="text-sm italic text-zinc-600 dark:text-zinc-400">
        &ldquo;{citation.quote}&rdquo;
      </p>
    </div>
  );
}
