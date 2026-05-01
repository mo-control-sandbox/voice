import {
  VoxtralRealtimeForConditionalGeneration,
  VoxtralRealtimeProcessor,
} from '@huggingface/transformers';
import type { StreamingModelStore } from '../streaming/StreamingModelStore';
import type { VoxtralRealtimeProcessorShim } from './TypeShim';

/**
 * Runtime state required to execute Voxtral streaming inference.
 */
export interface VoxtralRuntimeHandle {
  readonly model: VoxtralRealtimeForConditionalGeneration;
  readonly processor: VoxtralRealtimeProcessorShim;
}

/**
 * Caches the currently loaded Voxtral model and reloads it when modelId changes.
 */
export class VoxtralInMemoryModel implements StreamingModelStore<VoxtralRuntimeHandle> {
  /**
   * Loaded model instance for the active model id.
   */
  private model: VoxtralRealtimeForConditionalGeneration | null = null;

  /**
   * Loaded processor instance for the active model id.
   */
  private processor: VoxtralRealtimeProcessor | null = null;

  /**
   * Model identifier currently loaded into this worker.
   */
  private currentModelId: string | null = null;

  /**
   * Ensures the requested model pair is loaded in memory.
   */
  async load(modelId: string): Promise<void> {
    if (this.currentModelId === modelId && this.model !== null) {
      return;
    }

    // from_pretrained is typed to return the PreTrainedModel base class.
    // The cast narrows to the concrete subclass we requested.
    this.model = await VoxtralRealtimeForConditionalGeneration.from_pretrained(modelId, {
      dtype: {
        audio_encoder: 'q4f16',
        embed_tokens: 'q4f16',
        decoder_model_merged: 'q4f16',
      },
      device: 'webgpu',
    }) as VoxtralRealtimeForConditionalGeneration;

    this.processor = await VoxtralRealtimeProcessor.from_pretrained(
      modelId,
    ) as VoxtralRealtimeProcessor;

    this.currentModelId = modelId;
  }

  /**
   * Clears cached model state.
   */
  reset(): void {
    this.model = null;
    this.processor = null;
  }

  /**
   * Returns the loaded model and typed processor facade when available.
   */
  get(): VoxtralRuntimeHandle | null {
    if (this.model === null || this.processor === null) return null;
    return {
      model: this.model,
      // Cast once to avoid repeated non-null assertions on internals.
      processor: this.processor as unknown as VoxtralRealtimeProcessorShim,
    };
  }
}
