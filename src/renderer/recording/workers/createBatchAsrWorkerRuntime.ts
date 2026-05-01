import type { BatchRunInput, BatchWorkerIncomingMessage, BatchWorkerResult } from './BatchWorkerProtocol';

/**
 * Transcription result emitted by a concrete worker pipeline implementation.
 */
export interface WorkerInferenceResult {
  text: string;
}

/**
 * Defines model-specific behavior used by the shared batch worker runtime.
 */
export interface BatchAsrWorkerRuntimeConfig<TPipeline> {
  workerName: string;
  loadPipeline(modelId: string): Promise<TPipeline>;
  runInference(pipeline: TPipeline, input: BatchRunInput): Promise<WorkerInferenceResult>;
}

/**
 * Installs a shared load/run message loop for batch ASR workers.
 */
export function createBatchAsrWorkerRuntime<TPipeline>(
  config: BatchAsrWorkerRuntimeConfig<TPipeline>,
): void {
  let pipeline: TPipeline | null = null;
  let currentModelId: string | null = null;
  let isRunning = false;
  let pendingLoad: string | null = null;

  self.onmessage = (event: MessageEvent<BatchWorkerIncomingMessage>): void => {
    const msg = event.data;

    if (msg.type === 'load') {
      if (isRunning) {
        pendingLoad = msg.modelId;
      } else {
        void loadModel(msg.modelId);
      }
      return;
    }

    void run(msg.input);
  };

  async function loadModel(modelId: string): Promise<void> {
    if (currentModelId === modelId && pipeline !== null) {
      console.log(`[${config.workerName}] model already loaded: ${modelId}`);
      self.postMessage({ type: 'loaded' } satisfies BatchWorkerResult);
      return;
    }

    console.log(`[${config.workerName}] loading model: ${modelId}`);
    try {
      pipeline = await config.loadPipeline(modelId);
      currentModelId = modelId;
      console.log(`[${config.workerName}] model loaded successfully: ${modelId}`);
      self.postMessage({ type: 'loaded' } satisfies BatchWorkerResult);
    } catch (err) {
      console.error(`[${config.workerName}] failed to load model: ${modelId}`, err);
      // Post a dummy error so callers do not wait indefinitely.
      self.postMessage({
        type: 'error',
        requestId: '',
        error: err instanceof Error ? err.message : String(err),
      } satisfies BatchWorkerResult);
    }
  }

  async function run(input: BatchRunInput): Promise<void> {
    isRunning = true;
    console.log(`[${config.workerName}] inference start: requestId=${input.requestId} samples=${String(input.samples.length)}`);

    try {
      if (pipeline === null) {
        console.error(`[${config.workerName}] inference attempted before model loaded`);
        self.postMessage({
          type: 'error',
          requestId: input.requestId,
          error: 'Model not loaded',
        } satisfies BatchWorkerResult);
        return;
      }

      const output = await config.runInference(pipeline, input);
      console.log(`[${config.workerName}] inference complete: requestId=${input.requestId} chars=${String(output.text.length)}`);
      self.postMessage({
        type: 'result',
        requestId: input.requestId,
        text: output.text.trim(),
      } satisfies BatchWorkerResult);
    } catch (err) {
      console.error(`[${config.workerName}] inference error: requestId=${input.requestId}`, err);
      self.postMessage({
        type: 'error',
        requestId: input.requestId,
        error: err instanceof Error ? err.message : String(err),
      } satisfies BatchWorkerResult);
    } finally {
      isRunning = false;

      if (pendingLoad !== null) {
        const modelToLoad = pendingLoad;
        pendingLoad = null;
        await loadModel(modelToLoad);
      }
    }
  }
}
