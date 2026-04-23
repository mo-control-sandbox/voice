import type { ModelDefinition } from '../../types/models';
import type { BackendFactory } from './BackendFactory';
import type { TranscriptionBackend } from './TranscriptionBackend';
import { VoxtralRealtimeBackend } from './VoxtralRealtimeBackend';
import { WhisperBackend } from './WhisperBackend';

/**
 * A transcription backend backed by a downloaded local model with an explicit
 * lifecycle. Kept as a separate type so the factory can call `dispose()` without
 * widening `TranscriptionBackend` with lifecycle concerns.
 */
interface LocalModelBackend extends TranscriptionBackend {
  dispose(): void;
}

/**
 * BackendFactory for moVoice.
 *
 * Routes to WhisperBackend or VoxtralRealtimeBackend based on the model
 * definition's `inferenceMode`. Backends are cached per model and reused
 * across consecutive transcriptions, avoiding redundant worker spawns and
 * model reloads.
 */
export class MoVoiceBackendFactory implements BackendFactory {
  private cachedBackend: LocalModelBackend | null = null;
  private cachedModelId = '';

  createBackend(model: ModelDefinition): TranscriptionBackend {
    const modelId = model.huggingFaceRepo;
    if (this.cachedBackend === null || this.cachedModelId !== modelId) {
      this.cachedBackend?.dispose();
      this.cachedBackend =
        model.inferenceMode === 'voxtral-realtime'
          ? new VoxtralRealtimeBackend(modelId)
          : new WhisperBackend(modelId);
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
