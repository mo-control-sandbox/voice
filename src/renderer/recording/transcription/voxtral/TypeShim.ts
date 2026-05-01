import type { PreTrainedTokenizer } from '@huggingface/transformers';

/**
 * Shim types covering the subset of Transformers.js Voxtral processor shapes
 * used by the worker code.
 */

/**
 * The parts of a features tensor this worker uses.
 */
export interface FeaturesTensor {
  readonly dims: readonly number[];
}

/**
 * Shape consumed from the first-chunk processor call.
 */
export interface FirstChunkOutput {
  readonly input_ids: unknown;
  readonly input_features: FeaturesTensor;
}

/**
 * Shape consumed from subsequent chunk processor calls.
 */
export interface SubsequentChunkOutput {
  readonly input_features: FeaturesTensor;
}

/**
 * The subset of the feature extractor config we read.
 */
export interface FeatureExtractorConfig {
  readonly hop_length: number;
  readonly n_fft: number;
}

/**
 * Typed view of the VoxtralRealtimeProcessor internals used by the worker.
 */
export interface VoxtralRealtimeProcessorShim {
  readonly num_mel_frames_first_audio_chunk: number;
  readonly num_samples_first_audio_chunk: number;
  readonly num_samples_per_audio_chunk: number;
  readonly audio_length_per_tok: number;
  readonly feature_extractor: { readonly config: FeatureExtractorConfig };
  readonly tokenizer: PreTrainedTokenizer;
  _call(
    audio: Float32Array | Float64Array,
    options: { readonly is_streaming: true; readonly is_first_audio_chunk: boolean },
  ): Promise<FirstChunkOutput | SubsequentChunkOutput>;
}
