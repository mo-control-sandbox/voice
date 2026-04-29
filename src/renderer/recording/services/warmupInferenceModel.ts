import type { ModelDefinition, InferenceMode } from '../../types/models';

function getWorkerUrl(inferenceMode: InferenceMode): URL {
  if (inferenceMode === 'voxtral-realtime') {
    return new URL('../workers/VoxtralWorker.ts', import.meta.url);
  }
  if (inferenceMode === 'whisper') {
    return new URL('../workers/TransformersJsWorker.ts', import.meta.url);
  }
  return new URL('../workers/CohereTranscribeWorker.ts', import.meta.url);
}

/**
 * Loads the model inside its inference worker so WebGPU pipeline compilation
 * is cached in the worker context before the first recording session. The
 * worker is terminated immediately after the load acknowledgement.
 *
 * The main-thread load that happens during download compiles shaders for the
 * renderer context only; worker contexts maintain separate WebGPU pipeline
 * caches, so without this step the first recording always incurs a cold-start
 * delay.
 */
export async function warmupInferenceModel(
  definition: ModelDefinition,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) return;

  const worker = new Worker(getWorkerUrl(definition.inferenceMode), { type: 'module' });

  try {
    await new Promise<void>((resolve, reject) => {
      const cleanup = (): void => {
        signal?.removeEventListener('abort', onAbort);
        worker.removeEventListener('message', onMessage);
      };

      const onAbort = (): void => { cleanup(); resolve(); };

      const warmupStart = performance.now();

      const onMessage = (event: MessageEvent<{ type: string; error?: string }>): void => {
        if (event.data.type === 'loaded') {
          console.log(`[moVoice] Warmup (worker pipeline load): ${(performance.now() - warmupStart).toFixed(0)}ms`);
          cleanup();
          resolve();
        } else if (event.data.type === 'error') {
          cleanup();
          reject(new Error(event.data.error ?? 'worker load error'));
        }
      };

      signal?.addEventListener('abort', onAbort, { once: true });
      worker.addEventListener('message', onMessage);
      worker.postMessage({ type: 'load', modelId: definition.huggingFaceRepo });
    });
  } finally {
    worker.terminate();
  }
}
