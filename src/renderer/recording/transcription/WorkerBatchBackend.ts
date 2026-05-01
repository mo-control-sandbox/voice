import type { PcmAudio } from '../audio/PcmAudio';
import type { BatchWorkerResult } from '../workers/BatchWorkerProtocol';
import type { BatchBackend, TranscriptionResult } from './Backend';

/**
 * Constructor settings for a batch transcription backend that delegates to a worker.
 */
interface WorkerBatchBackendOptions {
  backendName: string;
  modelId: string;
  workerUrl: URL;
}

/**
 * Shared transport for batch transcription backends backed by web workers.
 */
export class WorkerBatchBackend implements BatchBackend {
  readonly mode = 'batch' as const;
  private worker: Worker | null = null;
  private workerModelLoaded = false;
  private nextRequestId = 0;

  constructor(private readonly options: WorkerBatchBackendOptions) {}

  /**
   * Loads the active model in the worker and returns one completed transcript.
   */
  async transcribe(
    audio: PcmAudio,
    language: string | null,
    signal: AbortSignal,
  ): Promise<TranscriptionResult | null> {
    const worker = this.ensureWorker();
    await this.loadModel(worker, signal);
    if (signal.aborted) {
      return null;
    }

    return this.runInWorker(worker, audio.samples, language, signal);
  }

  /**
   * Eagerly loads the model in the worker so the first transcription call starts without delay.
   */
  async prewarm(): Promise<void> {
    if (this.workerModelLoaded) return;
    const worker = this.ensureWorker();
    const ctrl = new AbortController();
    await this.loadModel(worker, ctrl.signal);
  }

  /**
   * Terminates the underlying worker and releases local resources.
   */
  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.workerModelLoaded = false;
  }

  /**
   * Lazily creates and returns the worker instance.
   */
  private ensureWorker(): Worker {
    this.worker ??= new Worker(this.options.workerUrl, { type: 'module' });
    return this.worker;
  }

  /**
   * Requests model loading in the worker and resolves once load is acknowledged.
   */
  private loadModel(worker: Worker, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      if (signal.aborted) {
        resolve();
        return;
      }

      const onAbort = (): void => {
        worker.removeEventListener('message', onMessage);
        resolve();
      };

      const onMessage = (event: MessageEvent<BatchWorkerResult>): void => {
        if (event.data.type === 'loaded') {
          signal.removeEventListener('abort', onAbort);
          worker.removeEventListener('message', onMessage);
          this.workerModelLoaded = true;
          resolve();
        }
      };

      signal.addEventListener('abort', onAbort, { once: true });
      worker.addEventListener('message', onMessage);
      worker.postMessage({ type: 'load', modelId: this.options.modelId });
    });
  }

  /**
   * Sends audio samples to the worker and resolves with the matching request result.
   */
  private runInWorker(
    worker: Worker,
    samples: Float32Array,
    language: string | null,
    signal: AbortSignal,
  ): Promise<TranscriptionResult | null> {
    const requestId = String(this.nextRequestId++);

    return new Promise((resolve) => {
      if (signal.aborted) {
        resolve(null);
        return;
      }

      const onAbort = (): void => {
        worker.removeEventListener('message', onMessage);
        resolve(null);
      };

      const onMessage = (event: MessageEvent<BatchWorkerResult>): void => {
        const msg = event.data;
        if (msg.type === 'result' && msg.requestId === requestId) {
          signal.removeEventListener('abort', onAbort);
          worker.removeEventListener('message', onMessage);
          resolve({ text: msg.text, detectedLanguage: msg.detectedLanguage });
        } else if (msg.type === 'error' && msg.requestId === requestId) {
          signal.removeEventListener('abort', onAbort);
          worker.removeEventListener('message', onMessage);
          console.error(`[${this.options.backendName}] worker error:`, msg.error);
          resolve(null);
        }
      };

      signal.addEventListener('abort', onAbort, { once: true });
      worker.addEventListener('message', onMessage);
      worker.postMessage({
        type: 'run',
        input: { samples, language, requestId },
      });
    });
  }
}
