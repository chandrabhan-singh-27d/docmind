export interface RetrievedChunk {
  readonly id: string;
  readonly documentId: string;
  readonly content: string;
  readonly chunkIndex: number;
  readonly similarity: number;
  readonly filename: string;
}

export interface Citation {
  readonly chunkId: string;
  readonly documentId: string;
  readonly quote: string;
  readonly filename: string;
  readonly relevance: number;
}

export interface ChatResponse {
  readonly answer: string;
  readonly citations: ReadonlyArray<Citation>;
}

export interface QueryContext {
  readonly query: string;
  readonly chunks: ReadonlyArray<RetrievedChunk>;
  readonly maxTokens: number;
}
