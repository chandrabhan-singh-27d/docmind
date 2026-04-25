'use client';

import { useState, useCallback } from 'react';
import UploadDropzone from '@/features/ingestion/components/upload-dropzone';
import DocumentList from '@/features/ingestion/components/document-list';
import ChatWindow from '@/features/chat/components/chat-window';

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<'documents' | 'chat'>('documents');

  const handleUploadComplete = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col p-8">
      <header className="mb-6 space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">DocMind</h1>
        <p className="text-zinc-500 dark:text-zinc-400">
          Upload documents. Ask questions. Get answers with citations.
        </p>
      </header>

      <nav className="mb-6 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('documents')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'documents'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          Documents
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'chat'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          Chat
        </button>
      </nav>

      {activeTab === 'documents' && (
        <div className="space-y-6">
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Upload Documents</h2>
            <UploadDropzone onUploadComplete={handleUploadComplete} />
          </section>
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Your Documents</h2>
            <DocumentList refreshKey={refreshKey} />
          </section>
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="flex flex-1 flex-col rounded-lg border border-zinc-200 dark:border-zinc-800">
          <ChatWindow />
        </div>
      )}
    </main>
  );
}
