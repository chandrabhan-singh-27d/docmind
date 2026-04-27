'use client';

import { useState, useCallback } from 'react';
import UploadDropzone from '@/features/ingestion/components/upload-dropzone';
import DocumentList from '@/features/ingestion/components/document-list';
import ChatWindow from '@/features/chat/components/chat-window';
import ThemeToggle from '@/components/theme-toggle';

interface ChatScopeDoc {
  readonly id: string;
  readonly filename: string;
}

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<'documents' | 'chat'>('documents');
  const [scopeDoc, setScopeDoc] = useState<ChatScopeDoc | null>(null);

  const handleUploadComplete = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const handleChatWithDoc = useCallback((doc: ChatScopeDoc) => {
    setScopeDoc(doc);
    setActiveTab('chat');
  }, []);

  const handleClearScope = useCallback(() => setScopeDoc(null), []);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col p-4 sm:p-8 min-h-0">
      <header className="mb-4 flex items-start justify-between gap-3 sm:mb-6">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">DocMind</h1>
          <p className="text-sm text-zinc-500 sm:text-base dark:text-zinc-400">
            Chat with your documents — grounded answers, transparent search.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <nav className="mb-4 flex gap-1 border-b border-zinc-200 sm:mb-6 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('documents')}
          className={`cursor-pointer px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
            activeTab === 'documents'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          Documents
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`cursor-pointer truncate px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
            activeTab === 'chat'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          {scopeDoc ? `Chat · ${scopeDoc.filename}` : 'Chat'}
        </button>
      </nav>

      {activeTab === 'documents' && (
        <div className="flex-1 min-h-0 space-y-6 overflow-y-auto pr-1">
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Upload Documents</h2>
            <UploadDropzone onUploadComplete={handleUploadComplete} />
          </section>
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Your Documents</h2>
            <DocumentList refreshKey={refreshKey} onChat={handleChatWithDoc} />
          </section>
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="flex flex-1 min-h-0 flex-col rounded-lg border border-zinc-200 dark:border-zinc-800">
          <ChatWindow scopeDoc={scopeDoc} onClearScope={handleClearScope} />
        </div>
      )}
    </main>
  );
}
