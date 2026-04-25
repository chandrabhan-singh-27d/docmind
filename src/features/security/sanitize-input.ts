/**
 * Prompt injection defense layer.
 *
 * User input is treated as DATA, never as instructions.
 * System prompts are immutable and constructed server-side only.
 */

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts)/i,
  /you\s+are\s+now\s+/i,
  /system\s*prompt/i,
  /reveal\s+(your|the)\s+(instructions|prompt|system)/i,
  /\bdo\s+not\s+follow\b/i,
  /\boverride\b.*\b(instructions|rules|prompt)\b/i,
  /\bjailbreak\b/i,
  /\bdan\s+mode\b/i,
] as const;

export const detectPromptInjection = (input: string): boolean =>
  INJECTION_PATTERNS.some((pattern) => pattern.test(input));

export const wrapUserQuery = (query: string): string =>
  `<user_query>\n${query}\n</user_query>`;

export const sanitizeForLogging = (text: string): string =>
  text.replace(
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    '[EMAIL_REDACTED]',
  ).replace(
    /\b\d{10,}\b/g,
    '[PHONE_REDACTED]',
  );
