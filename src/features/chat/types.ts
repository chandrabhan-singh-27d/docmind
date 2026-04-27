import type { Citation, RetrievedChunkDebug } from '@/features/retrieval/types';

export interface SearchStep {
  readonly id: string;
  readonly label: string;
  readonly detail?: string;
}

/** Params for streaming chat requests */
export interface ChatHistoryEntry {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

export interface StreamParams {
  readonly query: string;
  readonly topK?: number;
  readonly documentId?: string;
  readonly history?: ReadonlyArray<ChatHistoryEntry>;
  readonly signal?: AbortSignal;
}

/** SSE event types sent from server to client */
export type SseEvent =
  | { readonly type: 'delta'; readonly content: string }
  | { readonly type: 'citations'; readonly data: string }
  | { readonly type: 'chunks'; readonly data: string }
  | { readonly type: 'step'; readonly data: string }
  | { readonly type: 'done' }
  | { readonly type: 'error'; readonly data: string; readonly status: number };

/** Parsed SSE event received on the client */
export type ParsedSseEvent =
  | { readonly type: 'delta'; readonly content: string }
  | { readonly type: 'citations'; readonly citations: ReadonlyArray<Citation> }
  | { readonly type: 'chunks'; readonly chunks: ReadonlyArray<RetrievedChunkDebug> }
  | { readonly type: 'step'; readonly step: SearchStep }
  | { readonly type: 'done' }
  | { readonly type: 'error'; readonly error: string };

/** Chat message displayed in the UI */
export interface ChatMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly citations?: ReadonlyArray<Citation>;
  readonly chunks?: ReadonlyArray<RetrievedChunkDebug>;
  readonly steps?: ReadonlyArray<SearchStep>;
}
