import type {
  StreamingBackend,
  StreamingSession,
  TranscriptionResult,
} from '../Backend';
import type {
  StreamingWorkerCommand,
  StreamingWorkerResult,
} from './StreamingWorkerRuntime';

/**
 * Constructor settings for a streaming backend that delegates to a worker.
 */
interface WorkerStreamingBackendOptions {
  backendName: string;
  modelId: string;
  workerUrl: URL;
}

/**
 * One live streaming transcription session backed by a worker.
 */
class WorkerStreamingSession implements StreamingSession {
  /**
   * Audio chunks received before the worker starts processing.
   */
  private readonly pendingChunks: Float32Array[] = [];

  /**
   * Indicates whether the worker acknowledged the session start.
   */
  private workerReady = false;

  /**
   * Callback receiving incremental transcription text.
   */
  private partialResultCallback: ((text: string) => void) | null = null;

  /**
   * Listener forwarding partial-result messages for this request.
   */
  private readonly onWorkerMessage = (event: MessageEvent<StreamingWorkerResult>): void => {
    if (event.data.type === 'partial-result' && event.data.requestId === this.requestId) {
      this.partialResultCallback?.(event.data.text);
    }
  };

  /**
   * Model loading lifecycle for this session.
   */
  private readonly loadPromise: Promise<void>;

  constructor(
    private readonly worker: Worker,
    private readonly requestId: string,
    private readonly signal: AbortSignal,
    loadModel: (worker: Worker, signal: AbortSignal) => Promise<void>,
    private readonly backendName: string,
  ) {
    this.worker.addEventListener('message', this.onWorkerMessage);
    this.loadPromise = loadModel(this.worker, this.signal).then(() => {
      if (this.signal.aborted) return;
      const startMsg: StreamingWorkerCommand = { type: 'start', requestId: this.requestId };
      this.worker.postMessage(startMsg);
      this.workerReady = true;
      for (const chunk of this.pendingChunks) {
        const chunkMsg: StreamingWorkerCommand = { type: 'push-audio-chunk', samples: chunk };
        this.worker.postMessage(chunkMsg);
      }
      this.pendingChunks.length = 0;
    });
  }

  pushAudioChunk(samples: Float32Array): void {
    if (this.signal.aborted) return;
    // Slice to own the buffer -- the caller's Float32Array may be reused
    // by the AudioWorklet after this call returns.
    const copy = samples.slice();
    if (this.workerReady) {
      const chunkMsg: StreamingWorkerCommand = { type: 'push-audio-chunk', samples: copy };
      this.worker.postMessage(chunkMsg);
    } else {
      this.pendingChunks.push(copy);
    }
  }

  onTranscribed(cb: (text: string) => void): void {
    this.partialResultCallback = cb;
  }

  async finalize(): Promise<TranscriptionResult | null> {
    await this.loadPromise;
    if (this.signal.aborted) {
      this.worker.removeEventListener('message', this.onWorkerMessage);
      return null;
    }

    return new Promise((resolve) => {
      const clearFinalizeListeners = (): void => {
        this.signal.removeEventListener('abort', onAbort);
        this.worker.removeEventListener('message', onMessage);
        this.worker.removeEventListener('message', this.onWorkerMessage);
      };

      const onAbort = (): void => {
        const stopMsg: StreamingWorkerCommand = { type: 'stop' };
        this.worker.postMessage(stopMsg);
        clearFinalizeListeners();
        resolve(null);
      };

      const onMessage = (event: MessageEvent<StreamingWorkerResult>): void => {
        const workerResult = event.data;
        if (workerResult.type === 'result' && workerResult.requestId === this.requestId) {
          clearFinalizeListeners();
          resolve({ text: workerResult.text });
        } else if (workerResult.type === 'error' && workerResult.requestId === this.requestId) {
          clearFinalizeListeners();
          console.error(`[${this.backendName}] worker error:`, workerResult.error);
          resolve(null);
        }
      };

      this.signal.addEventListener('abort', onAbort, { once: true });
      this.worker.addEventListener('message', onMessage);
      const sealMsg: StreamingWorkerCommand = { type: 'seal' };
      this.worker.postMessage(sealMsg);
    });
  }

  cancel(): void {
    this.worker.removeEventListener('message', this.onWorkerMessage);
    const stopMsg: StreamingWorkerCommand = { type: 'stop' };
    this.worker.postMessage(stopMsg);
  }
}

/**
 * Shared transport for streaming transcription backends backed by web workers.
 */
export class WorkerStreamingBackend implements StreamingBackend {
  readonly mode = 'streaming' as const;
  private worker: Worker | null = null;
  private workerModelLoaded = false;
  private nextRequestId = 0;

  constructor(private readonly options: WorkerStreamingBackendOptions) {}

  start(signal: AbortSignal): StreamingSession {
    const worker = this.ensureWorker();
    const requestId = String(this.nextRequestId++);
    return new WorkerStreamingSession(
      worker,
      requestId,
      signal,
      this.loadModel.bind(this),
      this.options.backendName,
    );
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

      const onMessage = (event: MessageEvent<StreamingWorkerResult>): void => {
        if (event.data.type === 'loaded') {
          signal.removeEventListener('abort', onAbort);
          worker.removeEventListener('message', onMessage);
          this.workerModelLoaded = true;
          resolve();
        }
      };

      signal.addEventListener('abort', onAbort, { once: true });
      worker.addEventListener('message', onMessage);
      const loadMsg: StreamingWorkerCommand = { type: 'load', modelId: this.options.modelId };
      worker.postMessage(loadMsg);
    });
  }
}
