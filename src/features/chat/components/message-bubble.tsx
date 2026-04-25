'use client';

import type { Citation } from '@/features/retrieval/types';
import CitationCard from './citation-card';

interface Message {
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly citations?: ReadonlyArray<Citation>;
}

export default function MessageBubble({
  message,
}: {
  readonly message: Message;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] space-y-3 rounded-lg px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
        }`}
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.content}
        </p>

        {message.citations && message.citations.length > 0 && (
          <div className="space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-700">
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              Sources
            </p>
            {message.citations.map((citation, i) => (
              <CitationCard
                key={citation.chunkId}
                citation={citation}
                index={i}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
