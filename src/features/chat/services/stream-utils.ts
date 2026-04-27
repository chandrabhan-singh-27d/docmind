import type { ChatHistoryEntry } from '../types';

/**
 * Build the embedding query from recent conversation, so follow-ups like
 * "explain a bit more" can still retrieve relevant chunks. We bias toward
 * the prior user turn (which carried the topic) plus the new query.
 */
export const buildRetrievalQuery = (
  query: string,
  history?: ReadonlyArray<ChatHistoryEntry>,
): string => {
  if (!history || history.length === 0) return query;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entry = history[i];
    if (entry?.role === 'user') return `${entry.content}\n${query}`;
  }
  return query;
};

/**
 * Returns the largest index up to which `text` is safe to emit without
 * leaking even a partial citation marker. If the marker is fully present,
 * returns its start; otherwise checks whether any non-empty tail of `text`
 * could be a prefix of the marker, and holds those bytes back.
 */
export const safeEmitPosition = (text: string, marker: string): number => {
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
