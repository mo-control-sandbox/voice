import {
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
  type AutomaticSpeechRecognitionOutput,
} from '@huggingface/transformers';
import { configureTransformersWorkerEnvironment } from './configureTransformersWorkerEnvironment';
import { createBatchAsrWorkerRuntime } from './createBatchAsrWorkerRuntime';

configureTransformersWorkerEnvironment();

createBatchAsrWorkerRuntime<AutomaticSpeechRecognitionPipeline>({
  workerName: 'CohereTranscribeWorker',
  loadPipeline: async (modelId) => {
    // Prefer WebGPU for Cohere Transcribe; fall back to WASM if unavailable.
    // q4 keeps the download footprint to roughly 1 GB.
    try {
      return await pipeline('automatic-speech-recognition', modelId, {
        dtype: 'q4',
        device: 'webgpu',
      });
    } catch {
      console.warn('[CohereTranscribeWorker] WebGPU unavailable, falling back to WASM');
      return pipeline('automatic-speech-recognition', modelId, {
        dtype: 'q4',
      });
    }
  },
  runInference: async (asr, input) => {
    const options = input.language !== null ? { language: input.language } : {};
    const raw = await asr(input.samples, options) as AutomaticSpeechRecognitionOutput | AutomaticSpeechRecognitionOutput[];
    return {
      text: Array.isArray(raw) ? (raw[0]?.text ?? '') : raw.text,
      detectedLanguage: input.language ?? '',
    };
  },
});
