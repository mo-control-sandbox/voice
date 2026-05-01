import type { ModelDefinition } from '../../types/models';
import type { Backend } from './Backend';
import { TransformersBatchBackend } from './batch/TransformersBatchBackend';
import { VoxtralBackend } from './voxtral/VoxtralBackend';

/**
 * Creates and caches transcription backends for the lifetime of a recording window.
 *
 * Routes to batch or realtime backends based on the model
 * definition's inferenceMode. Backends are cached per model and reused
 * across consecutive transcriptions, avoiding redundant worker spawns and
 * model reloads.
 */
export class BackendFactory {
  private cachedBackend: Backend | null = null;
  private cachedModelId = '';

  createBackend(model: ModelDefinition): Backend {
    const modelId = model.huggingFaceRepo;
    if (this.cachedBackend === null || this.cachedModelId !== modelId) {
      this.cachedBackend?.dispose();
      if (model.inferenceMode === 'realtime') {
        this.cachedBackend = new VoxtralBackend(modelId);
      } else {
        this.cachedBackend = new TransformersBatchBackend(modelId);
      }
      this.cachedModelId = modelId;
    }

    return this.cachedBackend;
  }

  /**
   * Loads the given model in its inference worker ahead of the first recording.
   * Creates and caches the backend if not already present.
   */
  async prewarm(model: ModelDefinition): Promise<void> {
    const backend = this.createBackend(model);
    await backend.prewarm();
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
