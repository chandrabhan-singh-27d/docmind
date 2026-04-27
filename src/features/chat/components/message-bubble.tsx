'use client';

import type { ChatMessage } from '../types';
import SearchSteps from './search-steps';

export default function MessageBubble({
  message,
  isStreaming,
}: {
  readonly message: ChatMessage;
  readonly isStreaming?: boolean;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] space-y-3 rounded-lg px-3 py-2 text-sm sm:max-w-[80%] sm:px-4 sm:py-3 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
        }`}
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.content}
        </p>

        {!isUser && message.steps && message.steps.length > 0 && (
          <SearchSteps steps={message.steps} isStreaming={isStreaming ?? false} />
        )}
      </div>
    </div>
  );
}
