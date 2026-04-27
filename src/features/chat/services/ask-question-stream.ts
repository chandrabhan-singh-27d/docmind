import { searchDocuments } from '@/features/retrieval/services/search-documents';
import { buildQueryContext, buildMessages } from '@/features/retrieval/services/build-prompt';
import { streamChatCompletion } from '@/lib/llm/groq-client';
import { detectPromptInjection } from '@/features/security/sanitize-input';
import { countChunks } from '@/features/ingestion/repositories/document-repo';
import { parseLlmResponse } from './parse-citations';
import type { AppError } from '@/lib/errors';
import { toErrorResponse, toHttpStatus } from '@/lib/errors';
import type { ChatHistoryEntry, SseEvent, StreamParams } from '../types';

/**
 * Build the embedding query from recent conversation, so follow-ups like
 * "explain a bit more" can still retrieve relevant chunks. We bias toward
 * the prior user turn (which carried the topic) plus the new query.
 */
const buildRetrievalQuery = (
  query: string,
  history?: ReadonlyArray<ChatHistoryEntry>,
): string => {
  if (!history || history.length === 0) return query;
  const lastUserTurn = [...history].reverse().find((m) => m.role === 'user');
  return lastUserTurn ? `${lastUserTurn.content}\n${query}` : query;
};

const formatSseEvent = (event: SseEvent): string => {
  switch (event.type) {
    case 'delta':
      return `data: ${JSON.stringify({ type: 'delta', content: event.content })}\n\n`;
    case 'citations':
      return `data: ${JSON.stringify({ type: 'citations', citations: event.data })}\n\n`;
    case 'chunks':
      return `data: ${JSON.stringify({ type: 'chunks', chunks: event.data })}\n\n`;
    case 'step':
      return `data: ${JSON.stringify({ type: 'step', step: event.data })}\n\n`;
    case 'done':
      return `data: ${JSON.stringify({ type: 'done' })}\n\n`;
    case 'error':
      return `data: ${JSON.stringify({ type: 'error', error: event.data })}\n\n`;
  }
};

const stepEvent = (id: string, label: string, detail?: string): string =>
  formatSseEvent({
    type: 'step',
    data: JSON.stringify({ id, label, detail }),
  });

const PREVIEW_LEN = 200;
const toChunkDebug = (chunks: ReadonlyArray<{
  readonly id: string;
  readonly filename: string;
  readonly chunkIndex: number;
  readonly similarity: number;
  readonly content: string;
}>) =>
  chunks.map((c) => ({
    id: c.id,
    filename: c.filename,
    chunkIndex: c.chunkIndex,
    similarity: c.similarity,
    preview: c.content.length > PREVIEW_LEN ? `${c.content.slice(0, PREVIEW_LEN)}…` : c.content,
  }));

const CITATIONS_PREFIX = 'CITATIONS_JSON:';
const encoder = new TextEncoder();

/**
 * Returns the largest index up to which `text` is safe to emit without
 * leaking even a partial "CITATIONS_JSON:" marker. If the marker is fully
 * present, returns its start; otherwise checks whether any non-empty tail
 * of `text` could be a prefix of the marker, and holds those bytes back.
 */
const safeEmitPosition = (text: string, marker: string): number => {
  const fullIdx = text.indexOf(marker);
  if (fullIdx !== -1) return fullIdx;

  const maxK = Math.min(text.length, marker.length - 1);
  for (let k = maxK; k > 0; k -= 1) {
    if (text.endsWith(marker.slice(0, k))) {
      return text.length - k;
    }
  }
  return text.length;
};

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

  const retrievalQuery = buildRetrievalQuery(params.query, params.history);
  const usingHistory = retrievalQuery !== params.query;
  const searchScopeDetail = params.documentId
    ? `scoped to selected document`
    : 'across all uploaded documents';

  const earlySteps: string[] = [];
  earlySteps.push(
    stepEvent(
      'understand',
      'Understanding your question',
      usingHistory
        ? 'expanded with prior turn for follow-up context'
        : undefined,
    ),
  );
  earlySteps.push(
    stepEvent('search', 'Searching your documents', searchScopeDetail),
  );

  const searchResult = await searchDocuments(
    retrievalQuery,
    params.topK ?? 5,
    params.documentId,
  );
  if (!searchResult.ok) return createErrorStream(searchResult.error);

  if (searchResult.value.length === 0) {
    const totalChunks = await countChunks();
    const message =
      totalChunks === 0
        ? "I don't have any documents to search through. Please upload some documents first."
        : "I couldn't find anything relevant to your question in the uploaded documents. Try rephrasing or asking about specific topics covered in them.";

    const noMatchSteps = [
      ...earlySteps,
      stepEvent('matches', 'No matching passages found'),
    ];

    return new ReadableStream({
      start(controller) {
        for (const e of noMatchSteps) controller.enqueue(encoder.encode(e));
        controller.enqueue(encoder.encode(formatSseEvent({ type: 'delta', content: message })));
        controller.enqueue(encoder.encode(formatSseEvent({ type: 'done' })));
        controller.close();
      },
    });
  }

  const context = buildQueryContext(params.query, searchResult.value);
  const messages = buildMessages(context, params.history);
  const chunkDebug = toChunkDebug(searchResult.value);

  const matchDetail = searchResult.value
    .map((c) => `${c.filename} · ${(c.similarity * 100).toFixed(0)}%`)
    .join(', ');
  const matchesStep = stepEvent(
    'matches',
    `Found ${searchResult.value.length} relevant passage${searchResult.value.length === 1 ? '' : 's'}`,
    matchDetail,
  );
  const generatingStep = stepEvent('generate', 'Composing the answer');

  const streamResult = await streamChatCompletion({
    messages,
    temperature: 0.4,
    maxTokens: context.maxTokens,
    signal: params.signal,
  });

  if (!streamResult.ok) return createErrorStream(streamResult.error);

  const tokenStream = streamResult.value;

  return new ReadableStream({
    async start(controller) {
      let fullResponse = '';
      let emitted = 0;

      for (const e of earlySteps) controller.enqueue(encoder.encode(e));
      controller.enqueue(encoder.encode(matchesStep));
      controller.enqueue(encoder.encode(generatingStep));
      controller.enqueue(
        encoder.encode(formatSseEvent({ type: 'chunks', data: JSON.stringify(chunkDebug) })),
      );

      try {
        for await (const token of tokenStream) {
          fullResponse += token;

          const safe = safeEmitPosition(fullResponse, CITATIONS_PREFIX);
          if (safe > emitted) {
            const delta = fullResponse.slice(emitted, safe);
            controller.enqueue(encoder.encode(formatSseEvent({ type: 'delta', content: delta })));
            emitted = safe;
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
