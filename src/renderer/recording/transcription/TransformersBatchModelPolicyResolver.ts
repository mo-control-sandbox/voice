import type { BatchRunInput } from './batch/BatchWorkerProtocol';
import {
  buildCohereBatchInferenceOptions,
  COHERE_BATCH_LOAD_OPTIONS,
  isCohereBatchModel,
} from './cohere/CohereBatchPolicy';
import {
  buildWhisperBatchInferenceOptions,
  WHISPER_BATCH_LOAD_OPTIONS,
} from './whisper/WhisperBatchPolicy';

/**
 * Resolves pipeline load options for a specific model id.
 */
export function resolveTransformersBatchLoadOptions(modelId: string): Record<string, unknown> {
  return isCohereBatchModel(modelId)
    ? COHERE_BATCH_LOAD_OPTIONS
    : WHISPER_BATCH_LOAD_OPTIONS;
}

/**
 * Resolves inference options for one request using model-specific policy.
 */
export function resolveTransformersBatchInferenceOptions(input: BatchRunInput): Record<string, unknown> {
  const options: Record<string, unknown> = {};

  if (input.language !== null) {
    options.language = input.language;
  }

  if (isCohereBatchModel(input.modelId)) {
    Object.assign(options, buildCohereBatchInferenceOptions(input));
  } else {
    Object.assign(options, buildWhisperBatchInferenceOptions(input));
  }

  return options;
}
