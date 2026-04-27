import { WorkerBatchTranscriptionBackend } from './WorkerBatchTranscriptionBackend';

/**
 * Batch transcription backend for Whisper models.
 */
export class WhisperBackend extends WorkerBatchTranscriptionBackend {
  constructor(modelId: string) {
    super({
      backendName: 'WhisperBackend',
      modelId,
      workerUrl: new URL('../workers/TransformersJsWorker.ts', import.meta.url),
    });
  }
}
