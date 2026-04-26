'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { FormEvent } from 'react';
import type { ChatMessage, ParsedSseEvent } from '../types';
import type { Citation, RetrievedChunkDebug } from '@/features/retrieval/types';
import MessageBubble from './message-bubble';

const generateId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const applyStreamEvent = (
  messages: ReadonlyArray<ChatMessage>,
  targetId: string,
  event: ParsedSseEvent,
): ReadonlyArray<ChatMessage> => {
  switch (event.type) {
    case 'delta':
      return messages.map((m) =>
        m.id === targetId
          ? { ...m, content: m.content + event.content }
          : m,
      );

    case 'citations':
      return messages.map((m) =>
        m.id === targetId ? { ...m, citations: event.citations } : m,
      );

    case 'chunks':
      return messages.map((m) =>
        m.id === targetId ? { ...m, chunks: event.chunks } : m,
      );

    case 'error':
      return messages.map((m) =>
        m.id === targetId
          ? { ...m, content: event.error }
          : m,
      );

    case 'done':
      return messages;
  }
};

const parseSseData = (raw: string): ParsedSseEvent | null => {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const type = data['type'] as string;

    switch (type) {
      case 'delta':
        return { type: 'delta', content: (data['content'] as string) ?? '' };
      case 'citations':
        return {
          type: 'citations',
          citations: JSON.parse((data['citations'] as string) ?? '[]') as ReadonlyArray<Citation>,
        };
      case 'chunks':
        return {
          type: 'chunks',
          chunks: JSON.parse((data['chunks'] as string) ?? '[]') as ReadonlyArray<RetrievedChunkDebug>,
        };
      case 'error':
        return { type: 'error', error: (data['error'] as string) ?? 'An error occurred' };
      case 'done':
        return { type: 'done' };
      default:
        return null;
    }
  } catch {
    return null;
  }
};

export default function ChatWindow() {
  const [messages, setMessages] = useState<ReadonlyArray<ChatMessage>>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const query = input.trim();
      if (!query || isLoading) return;

      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: query,
      };
      const assistantId = generateId();

      setMessages((prev) => [
        ...prev,
        userMessage,
        { id: assistantId, role: 'assistant', content: '' },
      ]);
      setInput('');
      setIsLoading(true);

      abortRef.current = new AbortController();

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
          signal: abortRef.current.signal,
        });

        if (!response.ok || !response.body) {
          setMessages((prev) =>
            applyStreamEvent(prev, assistantId, {
              type: 'error',
              error: 'Something went wrong. Please try again.',
            }),
          );
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // SSE read loop: splits on double-newline, parses each event, updates message
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const segments = buffer.split('\n\n');
          buffer = segments.pop() ?? '';

          for (const segment of segments) {
            const dataLine = segment.replace(/^data: /, '');
            if (!dataLine) continue;

            const event = parseSseData(dataLine);
            if (event) {
              setMessages((prev) => applyStreamEvent(prev, assistantId, event));
            }
          }
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setMessages((prev) =>
          applyStreamEvent(prev, assistantId, {
            type: 'error',
            error: 'Network error. Please try again.',
          }),
        );
      } finally {
        abortRef.current = null;
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
