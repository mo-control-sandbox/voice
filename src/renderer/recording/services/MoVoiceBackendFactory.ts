import type { AnyModelDefinition } from '../../types/models';
import type { BackendFactory } from './BackendFactory';
import type { TranscriptionBackend } from './TranscriptionBackend';
import { BuiltinBackend } from './BuiltinBackend';
import { WhisperBackend } from './WhisperBackend';

/**
 * BackendFactory for moVoice.
 *
 * Selects between BuiltinBackend (macOS speech recognition) and WhisperBackend
 * (local Transformers.js inference) based on the model definition.
 * WhisperBackend instances are cached per model and reused across consecutive
 * transcriptions, avoiding redundant worker spawns and model reloads.
 */
export class MoVoiceBackendFactory implements BackendFactory {
  private whisperBackend: WhisperBackend | null = null;
  private currentModelId = '';

  createBackend(model: AnyModelDefinition): TranscriptionBackend {
    if (model.isBuiltin) {
      return new BuiltinBackend();
    }

    // Reuse the existing backend if the same Whisper model is selected again;
    // otherwise dispose the stale worker and spin up a new one.
    const modelId = model.huggingFaceRepo;
    if (this.whisperBackend === null || this.currentModelId !== modelId) {
      this.whisperBackend?.dispose();
      this.whisperBackend = new WhisperBackend(modelId);
      this.currentModelId = modelId;
    }

    return this.whisperBackend;
  }

  /**
   * Terminates any cached WhisperBackend worker and releases all resources.
   */
  dispose(): void {
    this.whisperBackend?.dispose();
    this.whisperBackend = null;
    this.currentModelId = '';
  }
}
