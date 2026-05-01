/**
 * Input payload for one batch transcription request.
 */
export interface BatchRunInput {
  modelId: string;
  samples: Float32Array;
  language: string | null;
  requestId: string;
}

/**
 * Messages sent from renderer services to a batch transcription worker.
 */
export type BatchWorkerIncomingMessage =
  | { type: 'load'; modelId: string }
  | { type: 'run'; input: BatchRunInput };

/**
 * Messages sent from a batch transcription worker to renderer services.
 */
export type BatchWorkerResult =
  | { type: 'loaded' }
  | { type: 'result'; requestId: string; text: string }
  | { type: 'error'; requestId: string; error: string };
