import { env } from '@huggingface/transformers';
import { OPFSModelCache } from '../../../models/OPFSModelCache';
import {
  StreamingInferenceCoordinator,
  type StreamingWorkerCommand,
  type StreamingWorkerResult,
} from '../streaming/StreamingWorkerRuntime';
import { VoxtralInMemoryModel, type VoxtralRuntimeHandle } from './VoxtralInMemoryModel';
import { VoxtralStreamingTranscriber } from './VoxtralStreamingTranscriber';

export type Command = StreamingWorkerCommand;
export type Result = StreamingWorkerResult;

// Configure Transformers.js to read pre-downloaded model files from OPFS
// via the shared OPFSModelCache. No model catalog is needed here -- workers
// only call match() and put(), which are URL-keyed and catalog-independent.
env.useBrowserCache = false;
env.useCustomCache = true;
env.customCache = new OPFSModelCache();

const coordinator = new StreamingInferenceCoordinator<VoxtralRuntimeHandle>(
  new VoxtralInMemoryModel(),
  (audioBuffer, emitResult) => new VoxtralStreamingTranscriber(audioBuffer, emitResult),
  (message) => {
    self.postMessage(message);
  },
  'VoxtralWorker',
);

self.onmessage = (event: MessageEvent<Command>): void => {
  coordinator.handleMessage(event.data);
};
