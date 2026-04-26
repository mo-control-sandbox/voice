import type { PcmAudio } from '../audio/PcmAudio';

/** Result of a successful transcription. */
export interface TranscriptionResult {
  readonly text: string;
  readonly detectedLanguage: string;
}

/**
 * Handle for one in-progress streaming transcription session.
 *
 * Chunks must be 16 kHz mono Float32 -- the format produced by AudioPipeline
 * when started at 16 kHz. finalize() signals end-of-audio and resolves with
 * the complete transcript, or null if the session was aborted.
 *
 * onPartialResult registers a callback that fires with each new piece of text
 * as the model decodes it, before the session is finalized. Text is incremental:
 * each call receives only the new words since the previous call.
 */
export interface StreamingSession {
  pushChunk(samples: Float32Array): void;
  onPartialResult(cb: (text: string) => void): void;
  finalize(): Promise<TranscriptionResult | null>;
  cancel(): void;
}

/**
 * Backend for models that require a complete audio buffer before inference
 * can begin, such as Whisper encoder-decoder architectures.
 */
export interface BatchTranscriptionBackend {
  readonly mode: 'batch';
  transcribe(
    audio: PcmAudio,
    language: string | null,
    signal: AbortSignal,
  ): Promise<TranscriptionResult | null>;
  dispose(): void;
}

/**
 * Backend for models capable of overlapping inference with audio capture.
 * Opens a session at the start of recording and accepts audio chunks
 * incrementally as they arrive from the microphone.
 */
export interface StreamingTranscriptionBackend {
  readonly mode: 'streaming';
  beginSession(language: string | null, signal: AbortSignal): StreamingSession;
  dispose(): void;
}

/** Union of all transcription backend types, narrowed by mode. */
export type TranscriptionBackend = BatchTranscriptionBackend | StreamingTranscriptionBackend;
