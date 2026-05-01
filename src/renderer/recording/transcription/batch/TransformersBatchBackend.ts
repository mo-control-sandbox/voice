import { WorkerBatchBackend } from './WorkerBatchBackend';

/**
 * Batch transcription backend for Transformers.js speech models.
 */
export class TransformersBatchBackend extends WorkerBatchBackend {
  constructor(modelId: string) {
    super({
      backendName: 'TransformersBatchBackend',
      modelId,
      workerUrl: new URL('./BatchTransformersWorker.ts', import.meta.url),
    });
  }
}
