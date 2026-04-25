import type { Citation } from '@/features/retrieval/types';

const CITATIONS_PREFIX = 'CITATIONS_JSON:';

interface ParsedResponse {
  readonly answer: string;
  readonly citations: ReadonlyArray<Citation>;
}

/**
 * Extracts the answer text and structured citations from the LLM response.
 * Citations are expected as a JSON array after the CITATIONS_JSON: prefix.
 */
export const parseLlmResponse = (raw: string): ParsedResponse => {
  const citationIndex = raw.indexOf(CITATIONS_PREFIX);

  if (citationIndex === -1) {
    return { answer: raw.trim(), citations: [] };
  }

  const answer = raw.slice(0, citationIndex).trim();
  const citationStr = raw.slice(citationIndex + CITATIONS_PREFIX.length).trim();

  try {
    const parsed = JSON.parse(citationStr) as ReadonlyArray<{
      chunkId: string;
      quote: string;
      filename: string;
      relevance: number;
    }>;

    const citations: ReadonlyArray<Citation> = parsed.map((c) => ({
      chunkId: c.chunkId,
      documentId: '',
      quote: c.quote,
      filename: c.filename,
      relevance: c.relevance,
    }));

    return { answer, citations };
  } catch {
    return { answer: raw.trim(), citations: [] };
  }
};
