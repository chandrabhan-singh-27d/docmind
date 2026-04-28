'use client';

import { useEffect, useState, useCallback, useTransition } from 'react';

interface DocumentItem {
  readonly id: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly totalChunks: number;
  readonly createdAt: string;
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const fetchDocumentList = async (): Promise<ReadonlyArray<DocumentItem>> => {
  const response = await fetch('/api/documents');
  const data = await response.json();
  return data.documents as ReadonlyArray<DocumentItem>;
};

import type { ChatScopeDoc } from '@/features/chat/types';

export default function DocumentList({
  refreshKey,
  onChat,
}: {
  readonly refreshKey: number;
  readonly onChat?: (doc: ChatScopeDoc) => void;
}) {
  const [documents, setDocuments] = useState<ReadonlyArray<DocumentItem>>([]);
  const [isPending, startTransition] = useTransition();
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchDocumentList()
      .then((docs) => {
        if (!cancelled) {
          setDocuments(docs);
          setInitialLoad(false);
        }
      })
      .catch(() => {
        if (!cancelled) setInitialLoad(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const handleDelete = useCallback((id: string) => {
    startTransition(async () => {
      await fetch(`/api/documents?id=${id}`, { method: 'DELETE' });
      const docs = await fetchDocumentList();
      setDocuments(docs);
    });
  }, []);

  if (initialLoad) {
    return <p className="text-sm text-zinc-500">Loading documents...</p>;
  }

  if (documents.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No documents uploaded yet. Upload one above to get started.
      </p>
    );
  }

  return (
    <ul className={`space-y-2 ${isPending ? 'opacity-60' : ''}`}>
      {documents.map((doc) => (
        <li
          key={doc.id}
          className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-medium">{doc.filename}</p>
            <p className="text-sm text-zinc-500">
              {formatBytes(doc.sizeBytes)} · {doc.totalChunks} chunks ·{' '}
              {formatDate(doc.createdAt)}
            </p>
          </div>
          <div className="ml-3 flex shrink-0 items-center gap-1">
            {onChat && (
              <button
                onClick={() => onChat({ id: doc.id, filename: doc.filename })}
                className="cursor-pointer rounded px-3 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:hover:bg-blue-950"
              >
                Chat
              </button>
            )}
            <button
              onClick={() => handleDelete(doc.id)}
              disabled={isPending}
              className="cursor-pointer rounded px-3 py-1.5 text-sm text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-950"
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
