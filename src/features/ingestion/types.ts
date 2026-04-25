export interface ParsedDocument {
  readonly content: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly contentHash: string;
}

export interface TextChunk {
  readonly content: string;
  readonly index: number;
  readonly tokenCount: number;
  readonly contentHash: string;
}

export interface EmbeddedChunk extends TextChunk {
  readonly embedding: ReadonlyArray<number>;
}

export interface ChunkingConfig {
  readonly chunkSize: number;
  readonly chunkOverlap: number;
  readonly maxChunks: number;
}

export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  chunkSize: 500,
  chunkOverlap: 100,
  maxChunks: 200,
} as const;
