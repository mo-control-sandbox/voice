import type { PcmAudio } from '../audio/PcmAudio';
import type { WorkerResult } from '../workers/TransformersJsWorker';
import type { TranscriptionBackend, TranscriptionResult } from './TranscriptionBackend';

/**
 * Wraps a TransformersJsWorker instance to satisfy the TranscriptionBackend contract.
 *
 * The worker is loaded lazily on the first call to transcribe(). Subsequent calls
 * for the same modelId reuse the already-loaded pipeline inside the worker.
 *
 * WhisperBackend expects audio at 16 kHz, mono, float32 — the format produced by
 * AudioPipeline. The PcmAudio type carries this metadata explicitly.
 */
export class WhisperBackend implements TranscriptionBackend {
  private worker: Worker | null = null;
  private nextRequestId = 0;

  constructor(private readonly modelId: string) {}

  async transcribe(
    audio: PcmAudio,
    language: string | null,
    signal: AbortSignal,
  ): Promise<TranscriptionResult | null> {
    const worker = this.ensureWorker();
    await this.loadModel(worker, signal);
    if (signal.aborted) return null;

    return this.runInWorker(worker, audio.samples, language, signal);
  }

  /**
   * Terminates the worker, releasing all resources.
   */
  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private ensureWorker(): Worker {
    this.worker ??= new Worker(
      new URL('../workers/TransformersJsWorker.ts', import.meta.url),
      { type: 'module' },
    );
    return this.worker;
  }

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

      const onMessage = (event: MessageEvent<WorkerResult>): void => {
        if (event.data.type === 'loaded') {
          signal.removeEventListener('abort', onAbort);
          worker.removeEventListener('message', onMessage);
          resolve();
        }
      };

      signal.addEventListener('abort', onAbort, { once: true });
      worker.addEventListener('message', onMessage);
      worker.postMessage({ type: 'load', modelId: this.modelId });
    });
  }

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

      const onMessage = (event: MessageEvent<WorkerResult>): void => {
        const msg = event.data;
        if (msg.type === 'result' && msg.requestId === requestId) {
          signal.removeEventListener('abort', onAbort);
          worker.removeEventListener('message', onMessage);
          resolve({ text: msg.text, detectedLanguage: msg.detectedLanguage });
        } else if (msg.type === 'error' && msg.requestId === requestId) {
          signal.removeEventListener('abort', onAbort);
          worker.removeEventListener('message', onMessage);
          console.error('[WhisperBackend] worker error:', msg.error);
          resolve(null);
        }
      };

      signal.addEventListener('abort', onAbort, { once: true });
      worker.addEventListener('message', onMessage);
      worker.postMessage({ type: 'run', input: { samples, language, requestId } });
    });
  }
}
