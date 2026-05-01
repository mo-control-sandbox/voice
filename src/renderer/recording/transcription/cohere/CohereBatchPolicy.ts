import type { BatchRunInput } from '../batch/BatchWorkerProtocol';

/**
 * Reports whether the model id belongs to the Cohere batch family.
 */
export function isCohereBatchModel(modelId: string): boolean {
  return modelId.includes('cohere-transcribe');
}

/**
 * Cohere-specific pipeline load options.
 */
export const COHERE_BATCH_LOAD_OPTIONS = {
  dtype: 'q4',
  device: 'webgpu',
} as const;

/**
 * Returns Cohere-specific decode options for one inference request.
 */
export function buildCohereBatchInferenceOptions(input: BatchRunInput): Record<string, unknown> {
  const durationSeconds = input.samples.length / 16000;
  return {
    max_new_tokens: Math.ceil(durationSeconds * 10),
  };
}

/**
 * Builds full decode options for one Cohere request.
 */
export function buildCohereBatchDecodeOptions(input: BatchRunInput): Record<string, unknown> {
  const options: Record<string, unknown> = {};
  if (input.language !== null) {
    options.language = input.language;
  }
  Object.assign(options, buildCohereBatchInferenceOptions(input));
  return options;
}
