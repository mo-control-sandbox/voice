/**
 * Worker thread script for Transformers.js ASR inference.
 * Must not import any MōBrowser API — those modules crash outside the main process.
 */
import { parentPort } from 'node:worker_threads';
import { pipeline, env } from '@huggingface/transformers';
import type { AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
import type { TranscriptionInput, TranscriptionResult } from '../../shared/types';

interface LoadModelMessage {
  readonly type: 'loadModel'
  readonly modelId: string
  readonly storagePath: string
}

interface RunMessage {
  readonly type: 'run'
  readonly input: TranscriptionInput
}

type WorkerMessage = LoadModelMessage | RunMessage

let transcriber: AutomaticSpeechRecognitionPipeline | null = null;

if (parentPort === null) {
  throw new Error('TransformersJsWorker must run inside a worker_threads.Worker');
}

const port = parentPort;

port.on('message', (msg: WorkerMessage) => {
  void handleMessage(msg);
});

async function handleMessage(msg: WorkerMessage): Promise<void> {
  if (msg.type === 'loadModel') {
    await loadModel(msg.modelId, msg.storagePath);
  } else {
    await runInference(msg.input);
  }
}

async function loadModel(modelId: string, storagePath: string): Promise<void> {
  try {
    env.cacheDir = storagePath;
    env.allowRemoteModels = false;

    transcriber = await pipeline('automatic-speech-recognition', modelId);
    port.postMessage({ type: 'modelLoaded' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    port.postMessage({ type: 'error', message });
  }
}

async function runInference(input: TranscriptionInput): Promise<void> {
  try {
    if (transcriber === null) {
      port.postMessage({ type: 'error', message: 'No model loaded' });
      return;
    }

    // Typed as unknown to prevent no-unsafe-assignment: the pipeline return type is opaque.
    const output: unknown = await transcriber(input.audio, {
      language: input.language ?? undefined,
      return_timestamps: false,
    });

    // The pipeline returns an object or array; normalise to { text }.
    const raw: unknown = Array.isArray(output) ? output[0] : output;
    const text = (raw as { text: string }).text.trim();

    const result: TranscriptionResult = {
      text,
      detectedLanguage: null,
    };

    port.postMessage({ type: 'result', output: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    port.postMessage({ type: 'error', message });
  }
}
