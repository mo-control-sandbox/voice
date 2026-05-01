import {
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
  type AutomaticSpeechRecognitionOutput,
} from '@huggingface/transformers';
import { configureTransformersWorkerEnvironment } from '../../workers/configureTransformersWorkerEnvironment';
import { createBatchAsrWorkerRuntime } from '../../workers/createBatchAsrWorkerRuntime';

configureTransformersWorkerEnvironment();

createBatchAsrWorkerRuntime<AutomaticSpeechRecognitionPipeline>({
  workerName: 'CohereWorker',
  loadPipeline: async (modelId) => {
    // Prefer WebGPU for Cohere Transcribe; fall back to WASM if unavailable.
    // q4 keeps the download footprint to roughly 1 GB.
    try {
      return await pipeline('automatic-speech-recognition', modelId, {
        dtype: 'q4',
        device: 'webgpu',
      });
    } catch {
      console.warn('[CohereWorker] WebGPU unavailable, falling back to WASM');
      return pipeline('automatic-speech-recognition', modelId, {
        dtype: 'q4',
      });
    }
  },
  runInference: async (asr, input) => {
    const durationSeconds = input.samples.length / 16000;
    const options: Record<string, unknown> = {
      // Allow 10 tokens per second of audio as a generous upper bound so the
      // model is never silently cut off by a small default max_new_tokens.
      max_new_tokens: Math.ceil(durationSeconds * 10),
    };
    if (input.language !== null) {
      options.language = input.language;
    }
    const raw = await asr(input.samples, options) as AutomaticSpeechRecognitionOutput | AutomaticSpeechRecognitionOutput[];
    return {
      text: Array.isArray(raw) ? (raw[0]?.text ?? '') : raw.text,
    };
  },
});
