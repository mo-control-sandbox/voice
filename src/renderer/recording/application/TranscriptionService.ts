import { AudioPipeline } from '../audio/AudioPipeline';
import { PcmAudio } from '../audio/PcmAudio';
import type { RendererModelRepository } from '../../services/RendererModelRepository';
import type { SubmitTranscriptionRequest } from '../../gen/recording';
import type { MoVoiceBackendFactory } from '../transcription/MoVoiceBackendFactory';
import type { Backend, StreamingSession } from '../transcription/Backend';

/**
 * Input data needed to start microphone capture for a session.
 */
export interface StartCaptureRequest {
  readonly sessionId: string;
  readonly audioInputDeviceId: string;
  readonly onTrackEnded: () => void;
  readonly onPartialResult: (text: string) => void;
  readonly onBatchMaxDurationReached: () => void;
  /** Called with batched PCM bytes to be persisted to disk. No-op when audio saving is disabled. */
  readonly onAudioChunk: (pcm: Uint8Array) => void;
}

/**
 * Result of attempting to start audio capture and backend session wiring.
 */
export type StartCaptureResult =
  | { readonly status: 'started' }
  | { readonly status: 'superseded' }
  | { readonly status: 'failed'; readonly errorMessage: string };

/**
 * Input data needed to finalize recording and process transcription.
 */
export interface StopAndProcessRequest {
  readonly sessionId: string;
}

/**
 * Finalization result emitted by the transcription service.
 */
export type StopAndProcessResult =
  | { readonly status: 'completed'; readonly submission: SubmitTranscriptionRequest }
  | { readonly status: 'cancelled' };

const BATCH_MAX_DURATION_MS = 10 * 60 * 1000; // 10 minutes

// Flush audio to disk roughly once per second of 16 kHz audio.
const AUDIO_FLUSH_SAMPLES = 16000;

/*
 * Silence appended to the audio tail before inference so the decoder sees a
 * clean end-of-speech boundary rather than an abrupt cut-off. The value is
 * well above the ~20-frame minimum needed for confident EOS token emission.
 * Does not affect saved audio -- only the buffer handed to the model.
 */
const SILENCE_PADDING_S = 1;

/**
 * Maps a getUserMedia error to a short, user-readable sentence.
 */
function classifyAudioError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
      return 'Microphone unavailable. Check your audio settings.';
    }
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return 'Microphone access denied. Open System Settings > Privacy.';
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return 'No microphone found. Connect one and try again.';
    }
  }
  return 'Could not start recording. Try again.';
}

/**
 * Transcription service that owns pipeline, backend, and inference state.
 */
export class TranscriptionService {
  /**
   * Active microphone pipeline for the current session, when available.
   */
  private pipeline: AudioPipeline | null = null;

  /**
   * Abort controller for the in-flight inference path.
   */
  private inferenceAbort: AbortController | null = null;

  /**
   * Active transcription backend chosen from current model settings.
   */
  private activeBackend: Backend | null = null;

  /**
   * Active streaming session handle for realtime backends.
   */
  private streamingSession: StreamingSession | null = null;

  /**
   * Effective language override resolved from active model preferences.
   */
  private resolvedLanguage: string | null = null;

  /**
   * Epoch timestamp captured when recording audio starts.
   */
  private recordingStartMs = 0;

  /**
   * Timeout used to auto-stop long batch recordings.
   */
  private batchMaxDurationTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Callback that receives batched PCM bytes for incremental disk persistence.
   * Registered from StartCaptureRequest and cleared after stopAndProcess completes.
   */
  private audioChunkCallback: ((pcm: Uint8Array) => void) | null = null;

  /**
   * Accumulator for the streaming audio flush path.
   */
  private audioBatch: Float32Array[] = [];

  /**
   * Number of samples currently held in audioBatch.
   */
  private audioBatchSamples = 0;

  constructor(
    private readonly modelRepository: RendererModelRepository,
    private readonly backendFactory: MoVoiceBackendFactory,
  ) {}

  /**
   * Eagerly loads the current active model in its inference worker.
   * No-op if no downloaded model is active.
   */
  async prewarmCurrentModel(): Promise<void> {
    const activeModel = await this.modelRepository.getActiveModel();
    if (!activeModel.isDownloaded) return;
    await this.backendFactory.prewarm(activeModel.definition);
  }

  /**
   * Reports whether audio pipeline is currently active.
   */
  get isAudioReady(): boolean {
    return this.pipeline !== null;
  }

  /**
   * Starts microphone capture and prepares inference backend for one session.
   */
  async startCapture(request: StartCaptureRequest): Promise<StartCaptureResult> {
    await this.cleanup();

    const activeModel = await this.modelRepository.getActiveModel();
    const language = activeModel.definition.isMultilingual
      ? await this.modelRepository.getLanguage()
      : null;
    this.resolvedLanguage = language === 'auto' ? null : (language ?? null);

    const backend = this.backendFactory.createBackend(activeModel.definition);
    this.activeBackend = backend;

    const abortController = new AbortController();
    this.inferenceAbort = abortController;

    const pipeline = new AudioPipeline();
    this.pipeline = pipeline;

    pipeline.onTrackEnded(() => {
      request.onTrackEnded();
    });

    this.audioChunkCallback = request.onAudioChunk;
    this.audioBatch = [];
    this.audioBatchSamples = 0;

    try {
      const pipelineSampleRate = backend.mode === 'streaming' ? 16000 : undefined;
      await pipeline.start(request.audioInputDeviceId, pipelineSampleRate);

      if (this.pipeline !== pipeline) {
        await pipeline.release();
        return { status: 'superseded' };
      }

      if (backend.mode === 'streaming') {
        const session = backend.start(abortController.signal);
        this.streamingSession = session;
        pipeline.onChunk((chunk) => {
          session.pushAudioChunk(chunk);
          this.bufferAudioChunk(chunk);
        });
        session.onTranscribed((text) => {
          request.onPartialResult(text);
        });
      } else {
        this.batchMaxDurationTimer = setTimeout(() => {
          this.batchMaxDurationTimer = null;
          request.onBatchMaxDurationReached();
        }, BATCH_MAX_DURATION_MS);
      }

      this.recordingStartMs = Date.now();
      return { status: 'started' };
    } catch (err) {
      console.error('[TranscriptionService] Failed to start audio:', err);
      this.pipeline = null;
      this.activeBackend = null;
      this.inferenceAbort = null;
      this.resolvedLanguage = null;
      this.recordingStartMs = 0;
      await pipeline.release();
      return { status: 'failed', errorMessage: classifyAudioError(err) };
    }
  }

  /**
   * Finalizes active recording and resolves completed transcription payload.
   */
  async stopAndProcess(request: StopAndProcessRequest): Promise<StopAndProcessResult> {
    this.clearBatchMaxDurationTimer();
    const pipeline = this.pipeline;
    const session = this.streamingSession;
    const backend = this.activeBackend;
    const language = this.resolvedLanguage;
    const abortController = this.inferenceAbort;

    this.pipeline = null;
    this.streamingSession = null;

    if (abortController === null) {
      return { status: 'cancelled' };
    }

    const recordingStopMs = Date.now();
    let result = null;
    let audioDurationSeconds = 0;

    if (session !== null) {
      // Push a silent tail so the decoder sees a clean end-of-speech boundary.
      const streamingSampleRate = 16000;
      const silenceTail = new Float32Array(Math.round(streamingSampleRate * SILENCE_PADDING_S));
      session.pushAudioChunk(silenceTail);

      const [transcriptionResult] = await Promise.all([
        session.finalize(),
        pipeline?.release(),
      ]);
      result = transcriptionResult;
      audioDurationSeconds = (recordingStopMs - this.recordingStartMs) / 1000;
      // Flush any buffered audio that did not yet reach the batch threshold.
      this.flushAudioBatch();
    } else {
      const audio = pipeline !== null
        ? await pipeline.stop()
        : new PcmAudio(new Float32Array(0), 16000, 1);

      audioDurationSeconds = audio.durationSeconds;

      if (backend !== null && backend.mode === 'batch') {
        // Pass silence-padded samples to the model; the saved PCM stays unpadded.
        const paddedAudio = audio.withSilencePadding(SILENCE_PADDING_S);
        result = await backend.transcribe(
          paddedAudio,
          language,
          abortController.signal,
        );
      }

      // Send the full resampled PCM as a single chunk for disk persistence.
      if (this.audioChunkCallback !== null) {
        this.audioChunkCallback(audio.toPcmBytes());
      }
    }

    this.inferenceAbort = null;
    this.activeBackend = null;
    this.resolvedLanguage = null;
    this.recordingStartMs = 0;
    this.audioChunkCallback = null;
    this.audioBatch = [];
    this.audioBatchSamples = 0;

    if (result === null) {
      return { status: 'cancelled' };
    }

    const engineLabel = (await this.modelRepository.getActiveModel()).definition.label;

    return {
      status: 'completed',
      submission: {
        sessionId: request.sessionId,
        text: result.text,
        audioDurationSeconds,
        transcriptionEngineLabel: engineLabel,
        streamed: session !== null,
      },
    };
  }

  /**
   * Cancels active session work and releases resources.
   */
  async cancel(): Promise<void> {
    await this.releaseRuntimeState();
  }

  /**
   * Releases active session resources without external side effects.
   */
  async cleanup(): Promise<void> {
    await this.releaseRuntimeState();
  }

  /**
   * Adds samples to the rolling audio batch and flushes when the threshold is reached.
   */
  private bufferAudioChunk(samples: Float32Array): void {
    this.audioBatch.push(samples);
    this.audioBatchSamples += samples.length;
    if (this.audioBatchSamples >= AUDIO_FLUSH_SAMPLES) {
      this.flushAudioBatch();
    }
  }

  /**
   * Merges the current audio batch and forwards it to the chunk callback.
   */
  private flushAudioBatch(): void {
    if (this.audioBatch.length === 0 || this.audioChunkCallback === null) return;
    const total = this.audioBatchSamples;
    const merged = new Float32Array(total);
    let offset = 0;
    for (const chunk of this.audioBatch) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    this.audioBatch = [];
    this.audioBatchSamples = 0;
    this.audioChunkCallback(new Uint8Array(merged.buffer, merged.byteOffset, merged.byteLength));
  }

  /**
   * Clears and removes the batch duration timeout.
   */
  private clearBatchMaxDurationTimer(): void {
    if (this.batchMaxDurationTimer !== null) {
      clearTimeout(this.batchMaxDurationTimer);
      this.batchMaxDurationTimer = null;
    }
  }

  /**
   * Clears local runtime state and tears down active audio resources.
   */
  private async releaseRuntimeState(): Promise<void> {
    this.clearBatchMaxDurationTimer();

    const session = this.streamingSession;
    this.streamingSession = null;
    session?.cancel();

    this.inferenceAbort?.abort();
    this.inferenceAbort = null;
    this.activeBackend = null;
    this.resolvedLanguage = null;
    this.recordingStartMs = 0;
    this.audioChunkCallback = null;
    this.audioBatch = [];
    this.audioBatchSamples = 0;

    const pipeline = this.pipeline;
    this.pipeline = null;
    if (pipeline !== null) {
      await pipeline.release();
    }
  }
}
