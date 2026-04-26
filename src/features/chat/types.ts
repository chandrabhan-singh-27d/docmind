import type { Citation, RetrievedChunkDebug } from '@/features/retrieval/types';

/** Params for streaming chat requests */
export interface StreamParams {
  readonly query: string;
  readonly topK?: number;
  readonly signal?: AbortSignal;
}

/** SSE event types sent from server to client */
export type SseEvent =
  | { readonly type: 'delta'; readonly content: string }
  | { readonly type: 'citations'; readonly data: string }
  | { readonly type: 'chunks'; readonly data: string }
  | { readonly type: 'done' }
  | { readonly type: 'error'; readonly data: string; readonly status: number };

/** Parsed SSE event received on the client */
export type ParsedSseEvent =
  | { readonly type: 'delta'; readonly content: string }
  | { readonly type: 'citations'; readonly citations: ReadonlyArray<Citation> }
  | { readonly type: 'chunks'; readonly chunks: ReadonlyArray<RetrievedChunkDebug> }
  | { readonly type: 'done' }
  | { readonly type: 'error'; readonly error: string };

/** Chat message displayed in the UI */
export interface ChatMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly citations?: ReadonlyArray<Citation>;
  readonly chunks?: ReadonlyArray<RetrievedChunkDebug>;
}
