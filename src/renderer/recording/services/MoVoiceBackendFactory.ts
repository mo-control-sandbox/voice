import type { ModelDefinition } from '../../types/models';
import type { TranscriptionBackend } from './TranscriptionBackend';
import { CohereTranscribeBackend } from './CohereTranscribeBackend';
import { VoxtralRealtimeBackend } from './VoxtralRealtimeBackend';
import { WhisperBackend } from './WhisperBackend';

/**
 * Creates and caches transcription backends for the lifetime of a recording window.
 *
 * Routes to WhisperBackend or VoxtralRealtimeBackend based on the model
 * definition's inferenceMode. Backends are cached per model and reused
 * across consecutive transcriptions, avoiding redundant worker spawns and
 * model reloads.
 */
export class MoVoiceBackendFactory {
  private cachedBackend: TranscriptionBackend | null = null;
  private cachedModelId = '';

  createBackend(model: ModelDefinition): TranscriptionBackend {
    const modelId = model.huggingFaceRepo;
    if (this.cachedBackend === null || this.cachedModelId !== modelId) {
      this.cachedBackend?.dispose();
      if (model.inferenceMode === 'voxtral-realtime') {
        this.cachedBackend = new VoxtralRealtimeBackend(modelId);
      } else if (model.inferenceMode === 'cohere-transcribe') {
        this.cachedBackend = new CohereTranscribeBackend(modelId);
      } else {
        this.cachedBackend = new WhisperBackend(modelId);
      }
      this.cachedModelId = modelId;
    }

    return this.cachedBackend;
  }

  /**
   * Terminates any cached local model backend and releases all resources.
   */
  dispose(): void {
    this.cachedBackend?.dispose();
    this.cachedBackend = null;
    this.cachedModelId = '';
  }
}
