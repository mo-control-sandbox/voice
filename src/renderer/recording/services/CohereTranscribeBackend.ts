import { WorkerBatchTranscriptionBackend } from './WorkerBatchTranscriptionBackend';

/**
 * Batch transcription backend for Cohere Transcribe models.
 */
export class CohereTranscribeBackend extends WorkerBatchTranscriptionBackend {
  constructor(modelId: string) {
    super({
      backendName: 'CohereTranscribeBackend',
      modelId,
      workerUrl: new URL('../workers/CohereTranscribeWorker.ts', import.meta.url),
    });
  }
}
