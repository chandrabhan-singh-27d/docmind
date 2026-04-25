import { searchDocuments } from '@/features/retrieval/services/search-documents';
import { buildQueryContext, buildMessages } from '@/features/retrieval/services/build-prompt';
import { streamChatCompletion } from '@/lib/llm/groq-client';
import { detectPromptInjection } from '@/features/security/sanitize-input';
import { parseLlmResponse } from './parse-citations';
import type { AppError } from '@/lib/errors';
import { toErrorResponse, toHttpStatus } from '@/lib/errors';
import type { SseEvent, StreamParams } from '../types';

const formatSseEvent = (event: SseEvent): string => {
  switch (event.type) {
    case 'delta':
      return `data: ${JSON.stringify({ type: 'delta', content: event.content })}\n\n`;
    case 'citations':
      return `data: ${JSON.stringify({ type: 'citations', citations: event.data })}\n\n`;
    case 'done':
      return `data: ${JSON.stringify({ type: 'done' })}\n\n`;
    case 'error':
      return `data: ${JSON.stringify({ type: 'error', error: event.data })}\n\n`;
  }
};

const CITATIONS_PREFIX = 'CITATIONS_JSON:';
const encoder = new TextEncoder();

const createErrorStream = (error: AppError): ReadableStream => {
  const response = toErrorResponse(error);
  const status = toHttpStatus(error);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(formatSseEvent({
          type: 'error',
          data: response.error.message,
          status,
        })),
      );
      controller.close();
    },
  });
};

export const askQuestionStream = async (
  params: StreamParams,
): Promise<ReadableStream> => {
  if (detectPromptInjection(params.query)) {
    return createErrorStream({ type: 'PROMPT_INJECTION_DETECTED' });
  }

  const searchResult = await searchDocuments(params.query, params.topK ?? 5);
  if (!searchResult.ok) return createErrorStream(searchResult.error);

  if (searchResult.value.length === 0) {
    return new ReadableStream({
      start(controller) {
        const noDocsMsg = 'I don\'t have any documents to search through. Please upload some documents first.';
        controller.enqueue(encoder.encode(formatSseEvent({ type: 'delta', content: noDocsMsg })));
        controller.enqueue(encoder.encode(formatSseEvent({ type: 'done' })));
        controller.close();
      },
    });
  }

  const context = buildQueryContext(params.query, searchResult.value);
  const messages = buildMessages(context);

  const streamResult = await streamChatCompletion({
    messages,
    maxTokens: context.maxTokens,
    signal: params.signal,
  });

  if (!streamResult.ok) return createErrorStream(streamResult.error);

  const tokenStream = streamResult.value;

  return new ReadableStream({
    async start(controller) {
      let fullResponse = '';

      try {
        for await (const token of tokenStream) {
          fullResponse += token;

          const citIdx = fullResponse.indexOf(CITATIONS_PREFIX);
          if (citIdx === -1) {
            controller.enqueue(encoder.encode(formatSseEvent({ type: 'delta', content: token })));
          }
        }

        const parsed = parseLlmResponse(fullResponse);
        if (parsed.citations.length > 0) {
          controller.enqueue(
            encoder.encode(formatSseEvent({
              type: 'citations',
              data: JSON.stringify(parsed.citations),
            })),
          );
        }

        controller.enqueue(encoder.encode(formatSseEvent({ type: 'done' })));
      } catch {
        controller.enqueue(
          encoder.encode(formatSseEvent({ type: 'error', data: 'Stream interrupted', status: 500 })),
        );
      } finally {
        controller.close();
      }
    },
  });
};
