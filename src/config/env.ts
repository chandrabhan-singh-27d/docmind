import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod/v4';

const envSchema = z.object({
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),
  HF_API_TOKEN: z.string().min(1, 'HF_API_TOKEN is required'),
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgresql://docmind:docmind_local@localhost:5432/docmind'),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().positive().default(20),
  EMBEDDING_MODEL: z.string().default('sentence-transformers/all-MiniLM-L6-v2'),
  LLM_MODEL: z.string().default('llama-3.3-70b-versatile'),
  MAX_CHUNKS_PER_QUERY: z.coerce.number().positive().default(5),
  RATE_LIMIT_RPM: z.coerce.number().positive().default(25),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

/**
 * Parse a dotenv-style file. Returns an empty object if the file is missing.
 * Supports `KEY=value`, optional surrounding single/double quotes, and `#` comments.
 */
const parseEnvFile = (path: string): Record<string, string> => {
  if (!existsSync(path)) return {};

  const out: Record<string, string> = {};
  const content = readFileSync(path, 'utf8');

  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    if (!key) continue;

    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    out[key] = value;
  }

  return out;
};

/**
 * Resolve an env source layered so that values defined in .env files take
 * precedence over the ambient shell environment (bashrc/zshrc exports).
 *
 * Priority (highest first):
 *   1. .env.local
 *   2. .env
 *   3. process.env (shell exports / platform-injected)
 *
 * This is the inverse of Next.js's default order — we deliberately let an
 * .env file override a stale shell export so a developer doesn't have to
 * `unset` their shell to test a different key.
 */
const resolveEnvSource = (): Record<string, string | undefined> => {
  const cwd = process.cwd();
  const fromDotenv = parseEnvFile(resolve(cwd, '.env'));
  const fromDotenvLocal = parseEnvFile(resolve(cwd, '.env.local'));

  return {
    ...process.env,
    ...fromDotenv,
    ...fromDotenvLocal,
  };
};

/**
 * Lazy env validation — only runs when first accessed at runtime,
 * not during next build (where env vars may not be set).
 */
export const getEnv = (): Env => {
  if (cachedEnv) return cachedEnv;

  const result = envSchema.safeParse(resolveEnvSource());

  if (!result.success) {
    const formatted = z.prettifyError(result.error);
    console.error('Environment validation failed:\n', formatted);
    throw new Error('Invalid environment configuration. Check your .env file.');
  }

  cachedEnv = result.data;
  return cachedEnv;
};
