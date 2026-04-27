'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import type { ChatMessage, ParsedSseEvent, SearchStep } from '../types';
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

    case 'step':
      return messages.map((m) =>
        m.id === targetId
          ? { ...m, steps: [...(m.steps ?? []), event.step] }
          : m,
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
      case 'step':
        return {
          type: 'step',
          step: JSON.parse(data['step'] as string) as SearchStep,
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

interface ScopeDoc {
  readonly id: string;
  readonly filename: string;
}

const HISTORY_TURNS = 6;

export default function ChatWindow({
  scopeDoc,
  onClearScope,
}: {
  readonly scopeDoc?: ScopeDoc | null;
  readonly onClearScope?: () => void;
}) {
  const [messages, setMessages] = useState<ReadonlyArray<ChatMessage>>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  const userMessages = useMemo(
    () => messages.filter((m) => m.role === 'user').map((m) => m.content),
    [messages],
  );

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
      setHistoryIndex(null);
      setDraft('');
      setIsLoading(true);

      abortRef.current = new AbortController();

      const history = messages
        .slice(-HISTORY_TURNS)
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            ...(scopeDoc ? { documentId: scopeDoc.id } : {}),
            ...(history.length > 0 ? { history } : {}),
          }),
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
    [input, isLoading, messages, scopeDoc],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (userMessages.length === 0) return;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIndex === null) {
          setDraft(input);
          setHistoryIndex(userMessages.length - 1);
          setInput(userMessages[userMessages.length - 1] ?? '');
        } else if (historyIndex > 0) {
          const next = historyIndex - 1;
          setHistoryIndex(next);
          setInput(userMessages[next] ?? '');
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex === null) return;
        const next = historyIndex + 1;
        if (next >= userMessages.length) {
          setHistoryIndex(null);
          setInput(draft);
        } else {
          setHistoryIndex(next);
          setInput(userMessages[next] ?? '');
        }
      }
    },
    [historyIndex, input, draft, userMessages],
  );

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      {scopeDoc && (
        <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-zinc-600 dark:text-zinc-300">
            Scoped to <span className="font-medium">{scopeDoc.filename}</span>
          </span>
          {onClearScope && (
            <button
              type="button"
              onClick={onClearScope}
              className="cursor-pointer text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              Clear scope
            </button>
          )}
        </div>
      )}
      <div className="flex-1 min-h-0 space-y-4 overflow-y-auto p-3 sm:p-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-zinc-400">
            Ask a question about your uploaded documents
          </p>
        )}
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isStreaming={isLoading && i === messages.length - 1}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="border-t border-zinc-200 p-3 sm:p-4 dark:border-zinc-800"
      >
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (historyIndex !== null) setHistoryIndex(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your documents... (↑/↓ for history)"
            autoFocus
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm outline-none transition-colors focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Ask
          </button>
        </div>
      </form>
    </div>
  );
}
