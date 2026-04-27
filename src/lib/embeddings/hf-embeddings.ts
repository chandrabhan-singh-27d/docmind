import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';
import type { Result } from '@/lib/result';
import { ok, err } from '@/lib/result';
import type { AppError } from '@/lib/errors';
import { getEnv } from '@/config/env';

interface EmbeddingParams {
  readonly texts: ReadonlyArray<string>;
  readonly model?: string;
}

/**
 * Embeddings run **locally** via @huggingface/transformers (Transformers.js)
 * with the ONNX-converted Xenova/all-MiniLM-L6-v2 model. No HF Inference API
 * call — the model is downloaded once to ~/.cache/huggingface on first use
 * and then served from this Node process.
 *
 * Configuration:
 *   pooling: 'mean'   — average token embeddings (matches sentence-transformers)
 *   normalize: true   — L2-normalize so cosine similarity == dot product
 */
let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;
let currentModel: string | null = null;

const getPipeline = async (model: string): Promise<FeatureExtractionPipeline> => {
  if (pipelinePromise && currentModel === model) return pipelinePromise;
  currentModel = model;
  pipelinePromise = pipeline('feature-extraction', model) as Promise<FeatureExtractionPipeline>;
  return pipelinePromise;
};

export const generateEmbeddings = async (
  params: EmbeddingParams,
): Promise<Result<ReadonlyArray<ReadonlyArray<number>>, AppError>> => {
  const model = params.model ?? getEnv().EMBEDDING_MODEL;

  try {
    const extractor = await getPipeline(model);
    const tensor = await extractor([...params.texts], {
      pooling: 'mean',
      normalize: true,
    });

    const dim = tensor.dims[1];
    if (typeof dim !== 'number') {
      return err({ type: 'EMBEDDING_FAILED', reason: 'Unexpected tensor shape' });
    }

    const data = tensor.data as Float32Array;
    const embeddings: number[][] = [];
    for (let i = 0; i < params.texts.length; i += 1) {
      embeddings.push(Array.from(data.slice(i * dim, (i + 1) * dim)));
    }

    return ok(embeddings);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown embedding error';
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
