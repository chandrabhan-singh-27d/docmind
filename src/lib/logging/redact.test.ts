import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { redactContext, redactMessage, redactStack } from './redact';

describe('redactMessage', () => {
  it('redacts Bearer tokens', () => {
    expect(redactMessage('Authorization: Bearer abc123def456ghi789'))
      .toBe('Authorization: Bearer [REDACTED]');
  });

  it('redacts password=value pairs', () => {
    expect(redactMessage('failed login: password=hunter2'))
      .toBe('failed login: password=[REDACTED]');
  });

  it('redacts long hex strings (likely API keys, hashes)', () => {
    expect(redactMessage('key: 0123456789abcdef0123456789abcdef0123456789'))
      .toBe('key: [HEX_REDACTED]');
  });

  it('passes benign text through unchanged', () => {
    expect(redactMessage('User clicked the button.')).toBe('User clicked the button.');
  });
});

describe('redactStack', () => {
  it('returns undefined for missing stack', () => {
    expect(redactStack(undefined)).toBeUndefined();
  });

  it('redacts secrets inside a stack trace', () => {
    const stack = 'Error: bad\n  at /home/x.js:1 token=abcdef0123456789abcdef0123456789';
    expect(redactStack(stack)).toContain('[HEX_REDACTED]');
  });
});

describe('redactContext', () => {
  beforeEach(() => {
    delete process.env['LOG_INCLUDE_QUERY'];
  });
  afterEach(() => {
    delete process.env['LOG_INCLUDE_QUERY'];
  });

  it('returns empty object when context is undefined', () => {
    expect(redactContext(undefined)).toEqual({});
  });

  it('redacts the `query` field by default', () => {
    expect(redactContext({ query: 'what is the secret?' }))
      .toEqual({ query: '[QUERY_REDACTED]' });
  });

  it('preserves the `query` field when LOG_INCLUDE_QUERY=true', () => {
    process.env['LOG_INCLUDE_QUERY'] = 'true';
    expect(redactContext({ query: 'what is the answer?' }))
      .toEqual({ query: 'what is the answer?' });
  });

  it('passes non-string values through untouched', () => {
    expect(redactContext({ count: 5, ok: true, items: [1, 2] }))
      .toEqual({ count: 5, ok: true, items: [1, 2] });
  });

  it('redacts string values that contain secrets', () => {
    expect(redactContext({ note: 'Authorization: Bearer xyz12345abcd' }))
      .toEqual({ note: 'Authorization: Bearer [REDACTED]' });
  });
});
