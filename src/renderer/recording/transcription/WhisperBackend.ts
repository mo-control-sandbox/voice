import { WorkerBatchBackend } from './WorkerBatchBackend';

/**
 * Batch transcription backend for Whisper models.
 */
export class WhisperBackend extends WorkerBatchBackend {
  constructor(modelId: string) {
    super({
      backendName: 'WhisperBackend',
      modelId,
      workerUrl: new URL('../workers/TransformersJsWorker.ts', import.meta.url),
    });
  }
}
