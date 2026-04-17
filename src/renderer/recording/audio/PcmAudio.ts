/**
 * A mono PCM audio buffer with explicit format metadata.
 *
 * Carries sample rate and channel count alongside the raw samples so that
 * consumers (transcription backends, storage, metrics) do not need to assume
 * an implicit format.
 */
export interface PcmAudio {
  /** Raw float32 samples, normalised to [-1, 1]. */
  readonly samples: Float32Array;
  /** Samples per second (e.g. 16 000 for Whisper-compatible input). */
  readonly sampleRate: number;
  /** Number of interleaved audio channels. */
  readonly channelCount: number;
}
