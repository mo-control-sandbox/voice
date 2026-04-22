import type { PcmAudio } from '../audio/PcmAudio';
import type { VoxtralWorkerResult } from '../workers/VoxtralWorker';
import type { TranscriptionBackend, TranscriptionResult } from './TranscriptionBackend';

/**
 * Transcription backend that runs Voxtral Realtime inference in a dedicated Web Worker.
 *
 * The complete audio buffer is sent to the worker in a single message. The
 * worker processes it in streaming chunks until the buffer is exhausted, then
 * returns the accumulated transcription. Cancellation is signalled by a `stop`
 * message, which causes the worker to exit its generator loop early.
 */
export class VoxtralRealtimeBackend implements TranscriptionBackend {
  private worker: Worker | null = null;
  private nextRequestId = 0;

  constructor(private readonly modelId: string) {}

  async transcribe(
    audio: PcmAudio,
    _language: string | null,
    signal: AbortSignal,
  ): Promise<TranscriptionResult | null> {
    const worker = this.ensureWorker();
    await this.loadModel(worker, signal);
    if (signal.aborted) return null;

    return this.runInWorker(worker, audio.samples, signal);
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
      new URL('../workers/VoxtralWorker.ts', import.meta.url),
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

      const onMessage = (event: MessageEvent<VoxtralWorkerResult>): void => {
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
    signal: AbortSignal,
  ): Promise<TranscriptionResult | null> {
    const requestId = String(this.nextRequestId++);

    return new Promise((resolve) => {
      if (signal.aborted) {
        resolve(null);
        return;
      }

      const onAbort = (): void => {
        worker.postMessage({ type: 'stop' });
        worker.removeEventListener('message', onMessage);
        resolve(null);
      };

      const onMessage = (event: MessageEvent<VoxtralWorkerResult>): void => {
        const msg = event.data;
        if (msg.type === 'result' && msg.requestId === requestId) {
          signal.removeEventListener('abort', onAbort);
          worker.removeEventListener('message', onMessage);
          // Voxtral auto-detects language; no per-session language reported.
          resolve({ text: msg.text, detectedLanguage: '' });
        } else if (msg.type === 'error' && msg.requestId === requestId) {
          signal.removeEventListener('abort', onAbort);
          worker.removeEventListener('message', onMessage);
          console.error('[VoxtralRealtimeBackend] worker error:', msg.error);
          resolve(null);
        }
      };

      signal.addEventListener('abort', onAbort, { once: true });
      worker.addEventListener('message', onMessage);
      worker.postMessage({ type: 'run', samples, requestId });
    });
  }
}
