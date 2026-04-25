import { searchDocuments } from '@/features/retrieval/services/search-documents';
import { buildQueryContext, buildMessages } from '@/features/retrieval/services/build-prompt';
import { chatCompletion } from '@/lib/llm/groq-client';
import { detectPromptInjection } from '@/features/security/sanitize-input';
import { parseLlmResponse } from './parse-citations';
import type { Result } from '@/lib/result';
import { ok, err } from '@/lib/result';
import type { AppError } from '@/lib/errors';
import type { ChatResponse } from '@/features/retrieval/types';

interface AskParams {
  readonly query: string;
  readonly topK?: number;
  readonly signal?: AbortSignal;
}

export const askQuestion = async (
  params: AskParams,
): Promise<Result<ChatResponse, AppError>> => {
  // Step 1: Prompt injection check
  if (detectPromptInjection(params.query)) {
    return err({ type: 'PROMPT_INJECTION_DETECTED' });
  }

  // Step 2: Search for relevant chunks
  const searchResult = await searchDocuments(params.query, params.topK ?? 5);
  if (!searchResult.ok) return searchResult;

  if (searchResult.value.length === 0) {
    return ok({
      answer:
        'I don\'t have any documents to search through. Please upload some documents first.',
      citations: [],
    });
  }

  // Step 3: Build prompt with context
  const context = buildQueryContext(params.query, searchResult.value);
  const messages = buildMessages(context);

  // Step 4: Call LLM
  const llmResult = await chatCompletion({
    messages,
    maxTokens: context.maxTokens,
    signal: params.signal,
  });
  if (!llmResult.ok) return llmResult;

  // Step 5: Parse response and extract citations
  const parsed = parseLlmResponse(llmResult.value.content);

  return ok(parsed);
};
