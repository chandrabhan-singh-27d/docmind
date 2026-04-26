import Groq from 'groq-sdk';
import type { Result } from '@/lib/result';
import { ok, err } from '@/lib/result';
import type { AppError } from '@/lib/errors';
import { getEnv } from '@/config/env';

interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

interface ChatCompletionParams {
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly model?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly signal?: AbortSignal;
}

interface ChatResponse {
  readonly content: string;
  readonly tokenUsage: {
    readonly prompt: number;
    readonly completion: number;
    readonly total: number;
  };
}

let clientInstance: Groq | null = null;

const client = (): Groq => {
  if (!clientInstance) {
    clientInstance = new Groq({ apiKey: getEnv().GROQ_API_KEY });
  }
  return clientInstance;
};

export const chatCompletion = async (
  params: ChatCompletionParams,
): Promise<Result<ChatResponse, AppError>> => {
  try {
    const response = await client().chat.completions.create(
      {
        model: params.model ?? getEnv().LLM_MODEL,
        messages: [...params.messages],
        temperature: params.temperature ?? 0.1,
        max_tokens: params.maxTokens ?? 2048,
      },
      { signal: params.signal },
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return err({ type: 'LLM_ERROR', reason: 'Empty response from LLM' });
    }

    return ok({
      content,
      tokenUsage: {
        prompt: response.usage?.prompt_tokens ?? 0,
        completion: response.usage?.completion_tokens ?? 0,
        total: response.usage?.total_tokens ?? 0,
      },
    });
  } catch (error) {
    if (error instanceof Groq.RateLimitError) {
      return err({ type: 'LLM_RATE_LIMITED', retryAfterMs: 60_000 });
    }

    const message = error instanceof Error ? error.message : 'Unknown LLM error';
    return err({ type: 'LLM_ERROR', reason: message });
  }
};

export const streamChatCompletion = async (
  params: ChatCompletionParams,
): Promise<Result<AsyncIterable<string>, AppError>> => {
  try {
    const stream = await client().chat.completions.create(
      {
        model: params.model ?? getEnv().LLM_MODEL,
        messages: [...params.messages],
        temperature: params.temperature ?? 0.1,
        max_tokens: params.maxTokens ?? 2048,
        stream: true,
      },
      { signal: params.signal },
    );

    const iterable: AsyncIterable<string> = {
      async *[Symbol.asyncIterator]() {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) yield delta;
        }
      },
    };

    return ok(iterable);
  } catch (error) {
    if (error instanceof Groq.RateLimitError) {
      return err({ type: 'LLM_RATE_LIMITED', retryAfterMs: 60_000 });
    }

    const message = error instanceof Error ? error.message : 'Unknown LLM error';
    return err({ type: 'LLM_ERROR', reason: message });
  }
};
