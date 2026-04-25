'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { FormEvent } from 'react';
import type { Citation } from '@/features/retrieval/types';
import MessageBubble from './message-bubble';

interface Message {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly citations?: ReadonlyArray<Citation>;
}

interface ChatApiResponse {
  readonly answer: string;
  readonly citations: ReadonlyArray<Citation>;
  readonly error?: { readonly message: string };
}

const generateId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export default function ChatWindow() {
  const [messages, setMessages] = useState<ReadonlyArray<Message>>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const query = input.trim();
      if (!query || isLoading) return;

      const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content: query,
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setIsLoading(true);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        });

        const data = (await response.json()) as ChatApiResponse;

        const assistantMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content: response.ok
            ? data.answer
            : data.error?.message ?? 'Something went wrong',
          citations: response.ok ? data.citations : undefined,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: 'assistant',
            content: 'Network error. Please try again.',
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading],
  );

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-zinc-400">
            Ask a question about your uploaded documents
          </p>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
              <p className="text-sm text-zinc-500">Thinking...</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="border-t border-zinc-200 p-4 dark:border-zinc-800"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your documents..."
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm outline-none transition-colors focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            Ask
          </button>
        </div>
      </form>
    </div>
  );
}
