/**
 * TEMPORARY — replaces TransformersJsBackend while the MōBrowser worker_threads
 * bug is unresolved. Runs Transformers.js inference directly on the main process
 * event loop. This will freeze IPC dispatch (and therefore the UI) for the
 * duration of each load and inference call. Remove this class and restore
 * TransformersJsBackend in Application.ts once the bug is fixed.
 *
 * Tracking issue: MōBrowser worker_threads crash in main process.
 */
import { pipeline, env } from '@huggingface/transformers';
import type { AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
import type { InferenceBackend, TranscriptionInput, TranscriptionResult } from '../../shared/types';

/**
 * Inline (no-worker) Transformers.js backend.
 * Preserves the sequential operation queue from the worker-based implementation
 * so that a model-switch during inference is queued rather than dropped.
 */
export class InlineTransformersJsBackend implements InferenceBackend<TranscriptionInput, TranscriptionResult> {
  private transcriber: AutomaticSpeechRecognitionPipeline | null = null;
  /** Tail of the sequential operation queue. */
  private queue: Promise<void> = Promise.resolve();
  private _isLoaded = false;

  get isLoaded(): boolean {
    return this._isLoaded;
  }

  /** Load a model from `storagePath` into the pipeline. Queued behind any running inference. */
  load(modelId: string, storagePath: string): Promise<void> {
    this._isLoaded = false;
    this.queue = this.queue.then(() => this.execLoad(modelId, storagePath));
    return this.queue;
  }

  /** Run inference on `input`. Queued behind any pending load or running inference. */
  run(input: TranscriptionInput): Promise<TranscriptionResult> {
    let resolve!: (result: TranscriptionResult) => void;
    let reject!: (err: Error) => void;
    const resultPromise = new Promise<TranscriptionResult>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    this.queue = this.queue.then(() =>
      this.execRun(input).then(resolve, reject),
    );

    return resultPromise;
  }

  /** Release the pipeline and free model weights from memory. */
  unload(): void {
    this._isLoaded = false;
    this.transcriber = null;
  }

  private async execLoad(modelId: string, storagePath: string): Promise<void> {
    // Trailing slash required: Transformers.js constructs paths as `${localModelPath}${modelId}/filename`.
    env.localModelPath = `${storagePath}/`;
    env.allowRemoteModels = false;
    env.useFS = true;
    this.transcriber = await pipeline('automatic-speech-recognition', modelId);
    this._isLoaded = true;
  }

  private async execRun(input: TranscriptionInput): Promise<TranscriptionResult> {
    if (this.transcriber === null) {
      throw new Error('No model loaded');
    }

    // Typed as unknown to prevent no-unsafe-assignment: the pipeline return type is opaque.
    const output: unknown = await this.transcriber(input.audio, {
      language: input.language ?? undefined,
      return_timestamps: false,
    });

    const raw: unknown = Array.isArray(output) ? output[0] : output;
    const text = (raw as { text: string }).text.trim();

    return { text, detectedLanguage: null };
  }
}
