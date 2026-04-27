import {
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
  type AutomaticSpeechRecognitionOutput,
} from '@huggingface/transformers';
import { configureTransformersWorkerEnvironment } from './configureTransformersWorkerEnvironment';
import { createBatchAsrWorkerRuntime } from './createBatchAsrWorkerRuntime';

configureTransformersWorkerEnvironment();

createBatchAsrWorkerRuntime<AutomaticSpeechRecognitionPipeline>({
  workerName: 'TransformersJsWorker',
  loadPipeline: async (modelId) => {
    // encoder_model stays at fp32: Whisper encoders are sensitive to quantisation.
    // decoder_model_merged uses q4: reduces memory footprint without accuracy loss.
    return pipeline('automatic-speech-recognition', modelId, {
      dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
    });
  },
  runInference: async (asr, input) => {
    const options = input.language !== null ? { language: input.language } : {};
    const raw = await asr(input.samples, options) as AutomaticSpeechRecognitionOutput | AutomaticSpeechRecognitionOutput[];
    return {
      text: extractText(raw),
      detectedLanguage: input.language ?? '',
    };
  },
});

/**
 * Extracts the transcription string from the Transformers.js pipeline output.
 * When the model returns a batch (array), we take the first element's text.
 */
function extractText(raw: AutomaticSpeechRecognitionOutput | AutomaticSpeechRecognitionOutput[]): string {
  if (Array.isArray(raw)) {
    return raw[0]?.text ?? '';
  }
  return raw.text;
}
