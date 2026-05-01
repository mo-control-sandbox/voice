import {
  env,
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
  type AutomaticSpeechRecognitionOutput,
} from '@huggingface/transformers';
import { OPFSModelCache } from '../../../models/OPFSModelCache';
import {
  buildCohereBatchDecodeOptions,
  COHERE_BATCH_LOAD_OPTIONS,
  isCohereBatchModel,
} from '../cohere/CohereBatchPolicy';
import {
  buildWhisperBatchDecodeOptions,
  WHISPER_BATCH_LOAD_OPTIONS,
} from '../whisper/WhisperBatchPolicy';
import { createBatchWorkerRuntime } from './BatchWorkerRuntime';

env.useBrowserCache = false;
env.useCustomCache = true;
env.customCache = new OPFSModelCache();

createBatchWorkerRuntime<AutomaticSpeechRecognitionPipeline>({
  workerName: 'BatchTransformersWorker',
  loadPipeline: async (modelId) => {
    const options = isCohereBatchModel(modelId)
      ? COHERE_BATCH_LOAD_OPTIONS
      : WHISPER_BATCH_LOAD_OPTIONS;
    return pipeline('automatic-speech-recognition', modelId, options);
  },
  runInference: async (asr, input) => {
    const options = isCohereBatchModel(input.modelId)
      ? buildCohereBatchDecodeOptions(input)
      : buildWhisperBatchDecodeOptions(input);
    const raw = await asr(input.samples, options) as AutomaticSpeechRecognitionOutput | AutomaticSpeechRecognitionOutput[];
    return Array.isArray(raw) ? (raw[0]?.text ?? '') : raw.text;
  },
});
