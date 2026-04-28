/**
 * Privacy-preserving redaction applied before any log event hits the
 * `error_events` table. The plan in docs/LOGGING.md treats user query text
 * as PII by default — useful for debugging *only* when LOG_INCLUDE_QUERY=true.
 *
 * This module also strips obvious credentials patterns (bearer tokens,
 * `password=...` strings) from messages and stacks. It's defensive, not
 * exhaustive: stack traces from third-party code can still leak weird
 * things, so we keep retention bounded and access controlled.
 */

// 32+ hex chars covers MD5, SHA-1, SHA-256 prefixes, and most leaked tokens.
const LONG_HEX = /\b[a-f0-9]{32,}\b/gi;
const BEARER = /\bBearer\s+[A-Za-z0-9._\-+/=]{8,}/g;
// Only match `=` form. Colons appear in normal log text ("level: error") and
// produced too many false positives.
// Negative lookahead `(?!\[)` prevents this from re-redacting values already
// processed by LONG_HEX or BEARER (which produce `[*_REDACTED]` markers).
const KEY_VAL = /\b(password|secret|token|api[-_]?key|authorization)\s*=\s*['"]?(?!\[)[^'"\s,;}]+/gi;

const redactString = (input: string | undefined): string | undefined => {
  if (!input) return input;
  return input
    .replace(LONG_HEX, '[HEX_REDACTED]')
    .replace(BEARER, 'Bearer [REDACTED]')
    .replace(KEY_VAL, '$1=[REDACTED]');
};

const includeQuery = (): boolean => process.env['LOG_INCLUDE_QUERY'] === 'true';

export const redactContext = (
  context: Readonly<Record<string, unknown>> | undefined,
): Record<string, unknown> => {
  if (!context) return {};

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (key === 'query' && !includeQuery()) {
      out[key] = '[QUERY_REDACTED]';
      continue;
    }
    if (typeof value === 'string') {
      out[key] = redactString(value);
    } else {
      out[key] = value;
    }
  }
  return out;
};

export const redactMessage = (message: string): string =>
  redactString(message) ?? '';

export const redactStack = (stack: string | undefined): string | undefined =>
  redactString(stack);
