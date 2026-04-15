import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import type { InferenceBackend, TranscriptionInput, TranscriptionResult } from '../../shared/types';

type WorkerResponse =
  | { readonly type: 'modelLoaded' }
  | { readonly type: 'result'; readonly output: TranscriptionResult }
  | { readonly type: 'error'; readonly message: string }

/**
 * Serialises `load()` and `run()` calls into a sequential promise chain so that
 * a model-switch request issued during active inference is queued rather than dropped.
 */
export class TransformersJsBackend implements InferenceBackend<TranscriptionInput, TranscriptionResult> {
  private readonly worker: Worker;
  /** Tail of the sequential operation queue. */
  private queue: Promise<void> = Promise.resolve();
  private _isLoaded = false;

  get isLoaded(): boolean {
    return this._isLoaded;
  }

  constructor() {
    const currentUrl = import.meta.url;
    const currentFile = fileURLToPath(currentUrl);
    const currentDir = dirname(currentFile);
    const workerPath = join(currentDir, '../workers/TransformersJsWorker.js');
    this.worker = new Worker(workerPath);
  }

  /** Load a model from `storagePath` into the worker. Queued behind any running inference. */
  load(modelId: string, storagePath: string): Promise<void> {
    this._isLoaded = false;
    this.queue = this.queue.then(() => this.sendLoad(modelId, storagePath));
    return this.queue;
  }

  /** Run inference on `input`. Queued behind any pending load or running inference. */
  run(input: TranscriptionInput): Promise<TranscriptionResult> {
    let resolve!: (result: TranscriptionResult) => void;
    let reject!: (err: Error) => void;
    const resultPromise = new Promise<TranscriptionResult>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    this.queue = this.queue.then(() =>
      this.sendRun(input).then(resolve, reject),
    );

    return resultPromise;
  }

  /** Terminate the worker and release resources. */
  unload(): void {
    this._isLoaded = false;
    void this.worker.terminate();
  }

  private sendLoad(modelId: string, storagePath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const handler = (msg: WorkerResponse): void => {
        if (msg.type === 'modelLoaded') {
          this._isLoaded = true;
          this.worker.off('message', handler);
          resolve();
        } else if (msg.type === 'error') {
          this.worker.off('message', handler);
          reject(new Error(msg.message));
        }
      };
      this.worker.on('message', handler);
      this.worker.postMessage({ type: 'loadModel', modelId, storagePath });
    });
  }

  private sendRun(input: TranscriptionInput): Promise<TranscriptionResult> {
    return new Promise<TranscriptionResult>((resolve, reject) => {
      const handler = (msg: WorkerResponse): void => {
        if (msg.type === 'result') {
          this.worker.off('message', handler);
          resolve(msg.output);
        } else if (msg.type === 'error') {
          this.worker.off('message', handler);
          reject(new Error(msg.message));
        }
      };
      this.worker.on('message', handler);
      // Transfer the underlying ArrayBuffer so the audio data is zero-copied.
      this.worker.postMessage(
        { type: 'run', input },
        [input.audio.buffer as ArrayBuffer],
      );
    });
  }
}
