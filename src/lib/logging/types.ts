/**
 * Shared shape for both client and server loggers. The persistence layer
 * adds server-derived fields (request_id, user_agent, ip-hash) before
 * inserting; the client never sees those.
 */
export type LogLevel = 'error' | 'warn' | 'info';
export type LogSource = 'frontend' | 'backend';

export interface LogEventInput {
  readonly level: LogLevel;
  readonly message: string;
  readonly stack?: string;
  readonly route?: string;
  readonly url?: string;
  readonly context?: Readonly<Record<string, unknown>>;
}
