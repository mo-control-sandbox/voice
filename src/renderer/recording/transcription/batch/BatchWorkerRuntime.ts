import type { BatchRunInput, BatchWorkerIncomingMessage, BatchWorkerResult } from './BatchWorkerProtocol';

/**
 * Defines model-specific behavior used by the shared batch worker runtime.
 */
export interface BatchWorkerRuntimeConfig<TPipeline> {
  workerName: string;
  loadPipeline(modelId: string): Promise<TPipeline>;
  runInference(pipeline: TPipeline, input: BatchRunInput): Promise<string>;
}

/**
 * Coordinates one batch worker lifecycle with model loading and inference.
 */
export class BatchWorkerRuntime<TPipeline> {
  private pipeline: TPipeline | null = null;
  private currentModelId: string | null = null;
  private isRunning = false;
  private isLoading = false;
  private pendingLoad: string | null = null;

  constructor(private readonly config: BatchWorkerRuntimeConfig<TPipeline>) {}

  /**
   * Handles one incoming worker command message.
   */
  handleMessage(msg: BatchWorkerIncomingMessage): void {
    if (msg.type === 'load') {
      if (this.isRunning || this.isLoading) {
        this.pendingLoad = msg.modelId;
      } else {
        void this.loadModel(msg.modelId);
      }
      return;
    }

    void this.run(msg.input);
  }

  /**
   * Binds this runtime instance to the worker message loop.
   */
  attachToSelf(): void {
    self.onmessage = (event: MessageEvent<BatchWorkerIncomingMessage>): void => {
      this.handleMessage(event.data);
    };
  }

  /**
   * Loads one model into worker memory.
   */
  private async loadModel(modelId: string): Promise<void> {
    if (this.currentModelId === modelId && this.pipeline !== null) {
      console.log(`[${this.config.workerName}] model already loaded: ${modelId}`);
      self.postMessage({ type: 'loaded' } satisfies BatchWorkerResult);
      return;
    }

    this.isLoading = true;
    console.log(`[${this.config.workerName}] loading model: ${modelId}`);
    try {
      this.pipeline = await this.config.loadPipeline(modelId);
      this.currentModelId = modelId;
      console.log(`[${this.config.workerName}] model loaded: ${modelId}`);
      self.postMessage({ type: 'loaded' } satisfies BatchWorkerResult);
    } catch (err) {
      console.error(`[${this.config.workerName}] failed to load model ${modelId}:`, err);
      // Post a dummy error so callers do not wait indefinitely.
      self.postMessage({
        type: 'error',
        requestId: '',
        error: err instanceof Error ? err.message : String(err),
      } satisfies BatchWorkerResult);
    } finally {
      this.isLoading = false;
      if (this.pendingLoad !== null) {
        const modelToLoad = this.pendingLoad;
        this.pendingLoad = null;
        await this.loadModel(modelToLoad);
      }
    }
  }

  /**
   * Executes one inference request using the currently loaded model.
   */
  private async run(input: BatchRunInput): Promise<void> {
    this.isRunning = true;
    console.log(`[${this.config.workerName}] inference start: requestId=${input.requestId} samples=${String(input.samples.length)}`);

    try {
      if (this.pipeline === null) {
        console.error(`[${this.config.workerName}] inference attempted before model loaded`);
        self.postMessage({
          type: 'error',
          requestId: input.requestId,
          error: 'Model not loaded',
        } satisfies BatchWorkerResult);
        return;
      }

      const text = await this.config.runInference(this.pipeline, input);
      console.log(`[${this.config.workerName}] inference complete: requestId=${input.requestId} chars=${String(text.length)}`);
      self.postMessage({
        type: 'result',
        requestId: input.requestId,
        text: text.trim(),
      } satisfies BatchWorkerResult);
    } catch (err) {
      console.error(`[${this.config.workerName}] inference error: requestId=${input.requestId}`, err);
      self.postMessage({
        type: 'error',
        requestId: input.requestId,
        error: err instanceof Error ? err.message : String(err),
      } satisfies BatchWorkerResult);
    } finally {
      this.isRunning = false;

      if (this.pendingLoad !== null) {
        const modelToLoad = this.pendingLoad;
        this.pendingLoad = null;
        await this.loadModel(modelToLoad);
      }
    }
  }
}

/**
 * Installs a shared load/run message loop for batch transcription workers.
 */
export function createBatchWorkerRuntime<TPipeline>(
  config: BatchWorkerRuntimeConfig<TPipeline>,
): void {
  new BatchWorkerRuntime(config).attachToSelf();
}
