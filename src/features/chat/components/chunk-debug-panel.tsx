'use client';

import { useState } from 'react';
import type { RetrievedChunkDebug } from '@/features/retrieval/types';

export default function ChunkDebugPanel({
  chunks,
}: {
  readonly chunks: ReadonlyArray<RetrievedChunkDebug>;
}) {
  const [open, setOpen] = useState(false);
  if (chunks.length === 0) return null;

  return (
    <div className="border-t border-zinc-200 pt-3 dark:border-zinc-700">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-semibold text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        {open ? 'Hide' : 'Show'} retrieval ({chunks.length})
      </button>
      {open && (
        <ol className="mt-2 space-y-2">
          {chunks.map((c, i) => (
            <li
              key={c.id}
              className="rounded-md border border-zinc-200 bg-white p-2 text-xs dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-zinc-600 dark:text-zinc-400">
                  #{i + 1} {c.filename} · chunk {c.chunkIndex}
                </span>
                <span className="font-mono text-zinc-500">
                  {(c.similarity * 100).toFixed(1)}%
                </span>
              </div>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">{c.preview}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
