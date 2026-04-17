import type { PcmAudio } from '../audio/PcmAudio';
import type { TranscriptionBackend, TranscriptionResult } from './TranscriptionBackend';

/**
 * Thin coordinator that runs transcription through a given backend.
 *
 * Has no knowledge of model identity or backend type — that selection
 * responsibility belongs to BackendFactory.
 */
export class TranscriptionOrchestrator {
  constructor(private readonly backend: TranscriptionBackend) {}

  /**
   * Runs transcription and returns the result, or null if the signal fires
   * before inference completes.
   */
  transcribe(
    audio: PcmAudio,
    language: string | null,
    signal: AbortSignal,
  ): Promise<TranscriptionResult | null> {
    return this.backend.transcribe(audio, language, signal);
  }
}
