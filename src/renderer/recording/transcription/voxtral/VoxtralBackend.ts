import { WorkerStreamingBackend } from '../streaming/WorkerStreamingBackend';

/**
 * Streaming transcription backend backed by a Voxtral worker runtime.
 */
export class VoxtralBackend extends WorkerStreamingBackend {
  constructor(modelId: string) {
    super({
      backendName: 'VoxtralBackend',
      modelId,
      workerFactory: () => new Worker(new URL('./VoxtralWorker.ts', import.meta.url), { type: 'module' }),
    });
  }
}
