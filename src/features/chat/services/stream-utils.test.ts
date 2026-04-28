import { describe, it, expect } from 'vitest';
import {
  buildRetrievalQuery,
  safeEmitPosition,
} from './stream-utils';

const MARKER = 'CITATIONS_JSON:';

describe('safeEmitPosition', () => {
  it('returns full length for empty text', () => {
    expect(safeEmitPosition('', MARKER)).toBe(0);
  });

  it('returns full length when no prefix overlap exists', () => {
    const text = 'Just a normal answer with no marker.';
    expect(safeEmitPosition(text, MARKER)).toBe(text.length);
  });

  it('returns the marker start index when the full marker is present', () => {
    const text = 'Answer body\nCITATIONS_JSON: [{}]';
    expect(safeEmitPosition(text, MARKER)).toBe('Answer body\n'.length);
  });

  it('holds back a single trailing character that could start the marker', () => {
    const text = 'Some answer\nC';
    expect(safeEmitPosition(text, MARKER)).toBe(text.length - 1);
  });

  it('holds back a longer trailing prefix that could continue into the marker', () => {
    const text = 'Some answer\nCITATI';
    expect(safeEmitPosition(text, MARKER)).toBe(text.length - 'CITATI'.length);
  });

  it('does not hold back when a similar tail is not actually a marker prefix', () => {
    const text = 'Some answer\nCITY';
    expect(safeEmitPosition(text, MARKER)).toBe(text.length);
  });

  it('prefers the full-marker index over tail-prefix matching when both could apply', () => {
    const text = 'CITATIONS_JSON:CITATIO';
    expect(safeEmitPosition(text, MARKER)).toBe(0);
  });
});

describe('buildRetrievalQuery', () => {
  it('returns the query unchanged when history is undefined', () => {
    expect(buildRetrievalQuery('explain more', undefined)).toBe('explain more');
  });

  it('returns the query unchanged when history is empty', () => {
    expect(buildRetrievalQuery('explain more', [])).toBe('explain more');
  });

  it('returns the query unchanged when history has no user turns', () => {
    expect(
      buildRetrievalQuery('explain more', [
        { role: 'assistant', content: 'sure' },
      ]),
    ).toBe('explain more');
  });

  it('prepends the most recent user turn for follow-up context', () => {
    expect(
      buildRetrievalQuery('explain more', [
        { role: 'user', content: 'how do databases store passwords?' },
        { role: 'assistant', content: 'they hash them' },
      ]),
    ).toBe('how do databases store passwords?\nexplain more');
  });

  it('uses the latest user turn when multiple exist', () => {
    expect(
      buildRetrievalQuery('go on', [
        { role: 'user', content: 'tell me about chunking' },
        { role: 'assistant', content: 'chunking splits text...' },
        { role: 'user', content: 'and how about embeddings?' },
        { role: 'assistant', content: 'embeddings are vectors...' },
      ]),
    ).toBe('and how about embeddings?\ngo on');
  });
});
