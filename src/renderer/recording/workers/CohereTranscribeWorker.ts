import {
  env,
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
  type AutomaticSpeechRecognitionOutput,
} from '@huggingface/transformers';
import { OPFSModelCache } from '../../services/OPFSModelCache';

env.useBrowserCache = false;
env.useCustomCache = true;
env.customCache = new OPFSModelCache();

/** Input payload for a transcription run. */
interface RunInput {
  samples: Float32Array;
  language: string | null;
  requestId: string;
}

/** Messages sent from the main thread to the worker. */
type IncomingMessage =
  | { type: 'load'; modelId: string }
  | { type: 'run'; input: RunInput };

/** Messages sent from the worker back to the main thread. */
export type WorkerResult =
  | { type: 'loaded' }
  | { type: 'result'; requestId: string; text: string; detectedLanguage: string }
  | { type: 'error'; requestId: string; error: string };

// ── Worker state ──────────────────────────────────────────────────────────────

let asr: AutomaticSpeechRecognitionPipeline | null = null;
let currentModelId: string | null = null;
let isRunning = false;

/** Pending load request queued while a run was in progress. */
let pendingLoad: string | null = null;

// ── Message handler ───────────────────────────────────────────────────────────

self.onmessage = (event: MessageEvent<IncomingMessage>): void => {
  const msg = event.data;

  if (msg.type === 'load') {
    if (isRunning) {
      pendingLoad = msg.modelId;
    } else {
      void loadModel(msg.modelId);
    }
    return;
  }

  void runInference(msg.input);
};

async function loadModel(modelId: string): Promise<void> {
  if (currentModelId === modelId && asr !== null) {
    self.postMessage({ type: 'loaded' } satisfies WorkerResult);
    return;
  }

  // Prefer WebGPU for Cohere Transcribe; fall back to WASM if unavailable.
  // q4 keeps the download footprint to roughly 1 GB.
  try {
    asr = await pipeline('automatic-speech-recognition', modelId, {
      dtype: 'q4',
      device: 'webgpu',
    });
  } catch {
    console.warn('[CohereTranscribeWorker] WebGPU unavailable, falling back to WASM');
    asr = await pipeline('automatic-speech-recognition', modelId, {
      dtype: 'q4',
    });
  }

  currentModelId = modelId;
  self.postMessage({ type: 'loaded' } satisfies WorkerResult);
}

async function runInference(input: RunInput): Promise<void> {
  isRunning = true;
  const { samples, language, requestId } = input;

  try {
    if (asr === null) {
      console.error('[CohereTranscribeWorker] run called but model is not loaded');
      self.postMessage({
        type: 'error',
        requestId,
        error: 'Model not loaded',
      } satisfies WorkerResult);
      return;
    }

    const options = language !== null ? { language } : {};
    const raw = await asr(samples, options) as AutomaticSpeechRecognitionOutput | AutomaticSpeechRecognitionOutput[];
    const text = Array.isArray(raw) ? (raw[0]?.text ?? '') : raw.text;

    self.postMessage({
      type: 'result',
      requestId,
      text: text.trim(),
      detectedLanguage: language ?? '',
    } satisfies WorkerResult);
  } catch (err) {
    console.error(`[CohereTranscribeWorker] inference error: requestId=${requestId}`, err);
    self.postMessage({
      type: 'error',
      requestId,
      error: err instanceof Error ? err.message : String(err),
    } satisfies WorkerResult);
  } finally {
    isRunning = false;

    if (pendingLoad !== null) {
      const modelToLoad = pendingLoad;
      pendingLoad = null;
      await loadModel(modelToLoad);
    }
  }
}
