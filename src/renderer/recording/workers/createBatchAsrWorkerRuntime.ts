import type { BatchRunInput, BatchWorkerIncomingMessage, BatchWorkerResult } from './BatchWorkerProtocol';

/**
 * Transcription result emitted by a concrete worker pipeline implementation.
 */
export interface WorkerInferenceResult {
  text: string;
  detectedLanguage: string;
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
      self.postMessage({ type: 'loaded' } satisfies BatchWorkerResult);
      return;
    }

    try {
      pipeline = await config.loadPipeline(modelId);
      currentModelId = modelId;
      self.postMessage({ type: 'loaded' } satisfies BatchWorkerResult);
    } catch (err) {
      console.error(`[${config.workerName}] Failed to load model:`, err);
    }
  }

  async function run(input: BatchRunInput): Promise<void> {
    isRunning = true;

    try {
      if (pipeline === null) {
        self.postMessage({
          type: 'error',
          requestId: input.requestId,
          error: 'Model not loaded',
        } satisfies BatchWorkerResult);
        return;
      }

      const output = await config.runInference(pipeline, input);
      self.postMessage({
        type: 'result',
        requestId: input.requestId,
        text: output.text.trim(),
        detectedLanguage: output.detectedLanguage,
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

