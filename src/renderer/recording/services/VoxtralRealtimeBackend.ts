import type { VoxtralWorkerResult } from '../workers/VoxtralWorker';
import type {
  StreamingSession,
  StreamingTranscriptionBackend,
  TranscriptionResult,
} from './TranscriptionBackend';

/**
 * Streaming transcription backend backed by a VoxtralWorker.
 *
 * Each call to beginSession() opens a new transcription session. Audio chunks
 * are pushed to the worker as they arrive from the microphone, allowing the
 * model to overlap inference with capture. finalize() signals end-of-audio and
 * resolves with the complete transcript once the worker drains its buffer.
 */
export class VoxtralRealtimeBackend implements StreamingTranscriptionBackend {
  readonly mode = 'streaming' as const;
  private worker: Worker | null = null;
  private workerModelLoaded = false;
  private nextRequestId = 0;

  constructor(private readonly modelId: string) {}

  beginSession(_language: string | null, signal: AbortSignal): StreamingSession {
    const worker = this.ensureWorker();
    const requestId = String(this.nextRequestId++);
    const pendingChunks: Float32Array[] = [];
    let workerReady = false;
    let partialResultCallback: ((text: string) => void) | null = null;

    // Persistent listener active for the entire session lifetime. Forwards
    // partial-result messages to the registered callback as the model decodes.
    const onWorkerMessage = (event: MessageEvent<VoxtralWorkerResult>): void => {
      if (event.data.type === 'partial-result' && event.data.requestId === requestId) {
        partialResultCallback?.(event.data.text);
      }
    };
    worker.addEventListener('message', onWorkerMessage);

    // Load the model asynchronously. Chunks that arrive before loading
    // completes are queued in pendingChunks and flushed once the worker
    // signals ready.
    const loadPromise = this.loadModel(worker, signal).then(() => {
      if (signal.aborted) return;
      worker.postMessage({ type: 'start', requestId });
      workerReady = true;
      for (const chunk of pendingChunks) {
        worker.postMessage({ type: 'push-chunk', samples: chunk });
      }
      pendingChunks.length = 0;
    });

    return {
      pushChunk(samples: Float32Array): void {
        if (signal.aborted) return;
        // Slice to own the buffer -- the caller's Float32Array may be reused
        // by the AudioWorklet after this call returns.
        const copy = samples.slice();
        if (workerReady) {
          worker.postMessage({ type: 'push-chunk', samples: copy });
        } else {
          pendingChunks.push(copy);
        }
      },

      onPartialResult(cb: (text: string) => void): void {
        partialResultCallback = cb;
      },

      async finalize(): Promise<TranscriptionResult | null> {
        await loadPromise;
        if (signal.aborted) {
          worker.removeEventListener('message', onWorkerMessage);
          return null;
        }

        return new Promise((resolve) => {
          const onAbort = (): void => {
            worker.postMessage({ type: 'stop' });
            worker.removeEventListener('message', onMessage);
            worker.removeEventListener('message', onWorkerMessage);
            resolve(null);
          };

          const onMessage = (event: MessageEvent<VoxtralWorkerResult>): void => {
            const msg = event.data;
            if (msg.type === 'result' && msg.requestId === requestId) {
              signal.removeEventListener('abort', onAbort);
              worker.removeEventListener('message', onMessage);
              worker.removeEventListener('message', onWorkerMessage);
              resolve({ text: msg.text, detectedLanguage: '' });
            } else if (msg.type === 'error' && msg.requestId === requestId) {
              signal.removeEventListener('abort', onAbort);
              worker.removeEventListener('message', onMessage);
              worker.removeEventListener('message', onWorkerMessage);
              console.error('[VoxtralRealtimeBackend] worker error:', msg.error);
              resolve(null);
            }
          };

          signal.addEventListener('abort', onAbort, { once: true });
          worker.addEventListener('message', onMessage);
          worker.postMessage({ type: 'seal' });
        });
      },

      cancel(): void {
        worker.removeEventListener('message', onWorkerMessage);
        worker.postMessage({ type: 'stop' });
      },
    };
  }

  /**
   * Eagerly loads the model in the worker so the first session starts without delay.
   */
  async prewarm(): Promise<void> {
    if (this.workerModelLoaded) return;
    const worker = this.ensureWorker();
    const ctrl = new AbortController();
    await this.loadModel(worker, ctrl.signal);
  }

  /**
   * Terminates the worker, releasing all resources.
   */
  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.workerModelLoaded = false;
  }

  // -- Private helpers -------------------------------------------------------

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
          this.workerModelLoaded = true;
          resolve();
        }
      };

      signal.addEventListener('abort', onAbort, { once: true });
      worker.addEventListener('message', onMessage);
      worker.postMessage({ type: 'load', modelId: this.modelId });
    });
  }
}
