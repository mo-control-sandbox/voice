import type { PcmAudio } from '../audio/PcmAudio';

/** 
 * Result of a successful transcription. 
 */
export interface TranscriptionResult {
  readonly text: string;
}

/**
 * Handle for one in-progress streaming backend session.
 */
export interface StreamingSession {
  /**
   * Appends one 16 kHz mono PCM chunk to the session input stream.
   */
  pushAudioChunk(samples: Float32Array): void;

  /**
   * Registers a callback that receives incremental decoded text while chunks are being appended.
   */
  onTranscribed(cb: (text: string) => void): void;

  /**
   * Seals the appended input stream and resolves with the final transcript result.
   */
  finalize(): Promise<TranscriptionResult | null>;

  /**
   * Aborts the active session and releases all resources immediately.
   */
  cancel(): void;
}

/**
 * Backend for models that require a complete audio buffer before inference
 * can begin, such as Whisper encoder-decoder architectures.
 */
export interface BatchBackend {
  /**
   * Discriminator used by TypeScript to narrow Backend unions at compile time.
   */
  readonly mode: 'batch';

  /**
   * Runs inference on a complete PCM buffer and resolves with the final transcript.
   */
  transcribe(
    audio: PcmAudio,
    language: string | null,
    abortSignal: AbortSignal,
  ): Promise<TranscriptionResult | null>;

  /**
   * Loads backend runtime state ahead of the first transcription request.
   */
  prewarm(): Promise<void>;

  /**
   * Releases backend resources and invalidates any cached runtime state.
   */
  dispose(): void;
}

/**
 * Backend for models capable of overlapping inference with audio capture.
 * 
 * Opens a session at the start of recording and accepts audio chunks
 * incrementally as they arrive from the microphone.
 */
export interface StreamingBackend {
  /**
   * Discriminator used by TypeScript to narrow Backend unions at compile time.
   */
  readonly mode: 'streaming';

  /**
   * Starts a streaming session that accepts incremental audio chunks and emits decoded text.
   */
  start(signal: AbortSignal): StreamingSession;

  /**
   * Loads backend runtime state ahead of the first streaming session.
   */
  prewarm(): Promise<void>;

  /**
   * Releases backend resources and invalidates any cached runtime state.
   */
  dispose(): void;
}

/**
 * The common type for batch and streaming transcription backends.
 */
export type Backend = BatchBackend | StreamingBackend;
