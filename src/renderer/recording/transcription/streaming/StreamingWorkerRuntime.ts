import { StreamingAudioBuffer } from './StreamingAudioBuffer';
import type { StreamingModelStore } from './StreamingModelStore';

/**
 * Worker command messages for a streaming transcription runtime.
 */
export type StreamingWorkerCommand =
  | { type: 'load'; modelId: string }
  | { type: 'start'; requestId: string }
  | { type: 'push-audio-chunk'; samples: Float32Array }
  | { type: 'seal' }
  | { type: 'stop' };

/**
 * Worker result messages for a streaming transcription runtime.
 */
export type StreamingWorkerResult =
  | { type: 'loaded' }
  | { type: 'partial-result'; requestId: string; text: string }
  | { type: 'result'; requestId: string; text: string }
  | { type: 'error'; requestId: string; error: string };

/**
 * Runs one streaming transcription request using model-specific runtime state.
 */
export interface StreamingTranscriber<TRuntimeHandle> {
  /**
   * Produces a full transcript and may emit partial updates during decoding.
   */
  transcribe(runtime: TRuntimeHandle, requestId: string): Promise<string>;
}

/**
 * Creates a streaming transcriber bound to shared runtime utilities.
 */
export type StreamingTranscriberFactory<TRuntimeHandle> = (
  audioBuffer: StreamingAudioBuffer,
  emitResult: (message: StreamingWorkerResult) => void,
) => StreamingTranscriber<TRuntimeHandle>;

/**
 * Coordinates worker protocol commands with model loading and stream inference.
 */
export class StreamingInferenceCoordinator<TRuntimeHandle> {
  private readonly audioBuffer: StreamingAudioBuffer;
  private readonly transcriber: StreamingTranscriber<TRuntimeHandle>;

  constructor(
    private readonly modelStore: StreamingModelStore<TRuntimeHandle>,
    transcriberFactory: StreamingTranscriberFactory<TRuntimeHandle>,
    private readonly emitResult: (message: StreamingWorkerResult) => void,
    private readonly workerName: string,
  ) {
    this.audioBuffer = new StreamingAudioBuffer();
    this.transcriber = transcriberFactory(this.audioBuffer, this.emitResult);
  }

  /**
   * Applies one incoming worker command.
   */
  handleMessage(msg: StreamingWorkerCommand): void {
    if (msg.type === 'load') {
      void this.load(msg.modelId);
      return;
    }

    if (msg.type === 'start') {
      // Do not clear buffered samples here -- chunks may arrive before start
      // while load is still in progress.
      this.audioBuffer.beginSession();
      void this.runInference(msg.requestId);
      return;
    }

    if (msg.type === 'push-audio-chunk') {
      this.audioBuffer.append(msg.samples);
      return;
    }

    if (msg.type === 'seal') {
      this.audioBuffer.seal();
      return;
    }

    this.audioBuffer.requestStop();
  }

  /**
   * Loads model state and publishes load result events.
   */
  private async load(modelId: string): Promise<void> {
    try {
      await this.modelStore.load(modelId);
      this.emitResult({ type: 'loaded' });
    } catch (err) {
      this.modelStore.reset();
      console.error(`[${this.workerName}] Failed to load model:`, err);
      this.emitResult({
        type: 'error',
        requestId: '',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Runs one inference request and publishes terminal result events.
   */
  private async runInference(requestId: string): Promise<void> {
    const runtime = this.modelStore.get();
    if (runtime === null) {
      this.emitResult({
        type: 'error',
        requestId,
        error: 'Model not loaded',
      });
      return;
    }

    try {
      const text = await this.transcriber.transcribe(runtime, requestId);
      if (!this.audioBuffer.isStopped()) {
        this.emitResult({
          type: 'result',
          requestId,
          text: text.trim(),
        });
      }
    } catch (err) {
      if (!this.audioBuffer.isStopped()) {
        this.emitResult({
          type: 'error',
          requestId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } finally {
      this.audioBuffer.resetAfterSession();
    }
  }
}
