import type { PcmAudio } from '../audio/PcmAudio';

/** Result of a successful transcription. */
export interface TranscriptionResult {
  readonly text: string;
  readonly detectedLanguage: string;
}

/**
 * Common interface for all transcription backends.
 *
 * The `audio` parameter carries explicit format metadata so backends can
 * validate or adapt the input without relying on implicit caller conventions.
 *
 * Implementations must respect the AbortSignal: if the signal fires before
 * inference completes, transcribe() must resolve to null.
 */
export interface TranscriptionBackend {
  transcribe(
    audio: PcmAudio,
    language: string | null,
    signal: AbortSignal,
  ): Promise<TranscriptionResult | null>;
}
