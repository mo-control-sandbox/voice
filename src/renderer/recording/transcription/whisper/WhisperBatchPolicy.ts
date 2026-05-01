import type { BatchRunInput } from '../batch/BatchWorkerProtocol';

/**
 * Whisper-specific pipeline load options.
 */
export const WHISPER_BATCH_LOAD_OPTIONS = {
  dtype: { encoder_model: 'q4', decoder_model_merged: 'q4' },
  device: 'webgpu',
} as const;

/**
 * Returns Whisper-specific decode options for one inference request.
 */
export function buildWhisperBatchInferenceOptions(_input: BatchRunInput): Record<string, unknown> {
  return {};
}

/**
 * Builds full decode options for one Whisper request.
 */
export function buildWhisperBatchDecodeOptions(input: BatchRunInput): Record<string, unknown> {
  const options: Record<string, unknown> = {};
  if (input.language !== null) {
    options.language = input.language;
  }
  Object.assign(options, buildWhisperBatchInferenceOptions(input));
  return options;
}
