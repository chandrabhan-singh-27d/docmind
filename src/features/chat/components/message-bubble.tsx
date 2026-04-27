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
        className={`max-w-[90%] space-y-3 rounded-lg px-4 py-3 sm:max-w-[80%] sm:px-5 sm:py-4 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
        }`}
      >
        <p
          className={`whitespace-pre-wrap font-serif text-[16px] leading-[1.65] sm:text-[17px] ${
            isUser ? '' : 'tracking-[-0.005em]'
          }`}
        >
          {message.content}
        </p>

        {!isUser && message.steps && message.steps.length > 0 && (
          <SearchSteps steps={message.steps} isStreaming={isStreaming ?? false} />
        )}
      </div>
    </div>
  );
}
