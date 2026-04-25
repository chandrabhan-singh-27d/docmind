import type { Result } from '@/lib/result';
import { ok, err } from '@/lib/result';
import type { AppError } from '@/lib/errors';

const HF_INFERENCE_URL = 'https://router.huggingface.co/hf-inference/pipeline/feature-extraction';

interface EmbeddingParams {
  readonly texts: ReadonlyArray<string>;
  readonly model?: string;
}

const getToken = (): string => {
  const token = process.env['HF_API_TOKEN'];
  if (!token) {
    throw new Error('HF_API_TOKEN is not set');
  }
  return token;
};

export const generateEmbeddings = async (
  params: EmbeddingParams,
): Promise<Result<ReadonlyArray<ReadonlyArray<number>>, AppError>> => {
  const model = params.model ?? 'sentence-transformers/all-MiniLM-L6-v2';
  const url = `${HF_INFERENCE_URL}/${model}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: params.texts }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return err({
        type: 'EMBEDDING_FAILED',
        reason: `HuggingFace API error (${response.status}): ${errorText}`,
      });
    }

    const embeddings = (await response.json()) as ReadonlyArray<ReadonlyArray<number>>;
    return ok(embeddings);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown embedding error';
    return err({ type: 'EMBEDDING_FAILED', reason: message });
  }
};

export const generateSingleEmbedding = async (
  text: string,
  model?: string,
): Promise<Result<ReadonlyArray<number>, AppError>> => {
  const result = await generateEmbeddings({ texts: [text], model });
  if (!result.ok) return result;

  const firstEmbedding = result.value[0];
  if (!firstEmbedding) {
    return err({ type: 'EMBEDDING_FAILED', reason: 'No embedding returned' });
  }

  return ok(firstEmbedding);
};
