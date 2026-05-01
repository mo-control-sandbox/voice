import {
  env,
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
  type AutomaticSpeechRecognitionOutput,
} from '@huggingface/transformers';
import { OPFSModelCache } from '../../../services/OPFSModelCache';
import {
  resolveTransformersBatchInferenceOptions,
  resolveTransformersBatchLoadOptions,
} from '../TransformersBatchModelPolicyResolver';
import { createBatchWorkerRuntime } from './BatchWorkerRuntime';

env.useBrowserCache = false;
env.useCustomCache = true;
env.customCache = new OPFSModelCache();

createBatchWorkerRuntime<AutomaticSpeechRecognitionPipeline>({
  workerName: 'BatchTransformersWorker',
  loadPipeline: async (modelId) => {
    const options = resolveTransformersBatchLoadOptions(modelId);
    return pipeline('automatic-speech-recognition', modelId, options);
  },
  runInference: async (asr, input) => {
    const options = resolveTransformersBatchInferenceOptions(input);
    const raw = await asr(input.samples, options) as AutomaticSpeechRecognitionOutput | AutomaticSpeechRecognitionOutput[];
    return Array.isArray(raw) ? (raw[0]?.text ?? '') : raw.text;
  },
});
