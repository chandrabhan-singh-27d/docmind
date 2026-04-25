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
 * Lazy env validation — only runs when first accessed at runtime,
 * not during next build (where env vars may not be set).
 */
export const getEnv = (): Env => {
  if (cachedEnv) return cachedEnv;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = z.prettifyError(result.error);
    console.error('Environment validation failed:\n', formatted);
    throw new Error('Invalid environment configuration. Check your .env file.');
  }

  cachedEnv = result.data;
  return cachedEnv;
};
