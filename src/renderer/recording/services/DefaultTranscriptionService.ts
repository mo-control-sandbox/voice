import { AudioPipeline } from '../audio/AudioPipeline';
import type { RendererModelRepository } from '../../services/RendererModelRepository';
import type { MoVoiceBackendFactory } from './MoVoiceBackendFactory';
import type { StreamingSession, TranscriptionBackend } from './TranscriptionBackend';
import type {
  StartCaptureRequest,
  StartCaptureResult,
  StopAndProcessRequest,
  StopAndProcessResult,
  TranscriptionService,
} from '../application/TranscriptionService';

const BATCH_MAX_DURATION_MS = 10 * 60 * 1000; // 10 minutes

/*
 * Silence appended to the audio tail before inference so the decoder sees a
 * clean end-of-speech boundary rather than an abrupt cut-off. The value is
 * well above the ~20-frame minimum needed for confident EOS token emission.
 * Does not affect saved audio -- only the buffer handed to the model.
 */
const SILENCE_PADDING_S = 1;

/**
 * Returns a new Float32Array with SILENCE_PADDING_S seconds of zeros appended.
 */
function withSilencePadding(samples: Float32Array, sampleRate: number): Float32Array {
  const paddingSamples = Math.round(sampleRate * SILENCE_PADDING_S);
  const padded = new Float32Array(samples.length + paddingSamples);
  padded.set(samples);
  return padded;
}

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
 * Default transcription service that owns pipeline, backend, and inference state.
 */
export class DefaultTranscriptionService implements TranscriptionService {
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
  private activeBackend: TranscriptionBackend | null = null;

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

  constructor(
    private readonly modelRepository: RendererModelRepository,
    private readonly backendFactory: MoVoiceBackendFactory,
  ) {}

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
      ? this.modelRepository.getLanguage()
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

    try {
      const pipelineSampleRate = backend.mode === 'streaming' ? 16000 : undefined;
      await pipeline.start(request.audioInputDeviceId, pipelineSampleRate);

      if (this.pipeline !== pipeline) {
        await pipeline.release();
        return { status: 'superseded' };
      }

      if (backend.mode === 'streaming') {
        const session = backend.beginSession(this.resolvedLanguage, abortController.signal);
        this.streamingSession = session;
        pipeline.onChunk((chunk) => {
          session.pushChunk(chunk);
        });
        session.onPartialResult((text) => {
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
      console.error('[DefaultTranscriptionService] Failed to start audio:', err);
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
    const inferenceStartMs = recordingStopMs;
    let result = null;
    let audioDurationSeconds = 0;
    let pcmBytes = new Uint8Array(0);

    if (session !== null) {
      // Push a silent tail so the decoder sees a clean end-of-speech boundary.
      const streamingSampleRate = 16000;
      const silenceTail = new Float32Array(Math.round(streamingSampleRate * SILENCE_PADDING_S));
      session.pushChunk(silenceTail);

      const [transcriptionResult] = await Promise.all([
        session.finalize(),
        pipeline?.release(),
      ]);
      result = transcriptionResult;
      audioDurationSeconds = (recordingStopMs - this.recordingStartMs) / 1000;
    } else {
      const audio = pipeline !== null
        ? await pipeline.stop()
        : { samples: new Float32Array(0), sampleRate: 16000, channelCount: 1 };

      audioDurationSeconds = audio.samples.length / audio.sampleRate;

      if (backend !== null && backend.mode === 'batch') {
        // Pass silence-padded samples to the model; the saved PCM stays unpadded.
        const paddedSamples = withSilencePadding(audio.samples, audio.sampleRate);
        result = await backend.transcribe(
          { ...audio, samples: paddedSamples },
          language,
          abortController.signal,
        );
      }

      if (request.dontSaveAudio) {
        pcmBytes = new Uint8Array(0);
      } else {
        const sourceBytes = new Uint8Array(
          audio.samples.buffer,
          audio.samples.byteOffset,
          audio.samples.byteLength,
        );
        const copiedBytes = new Uint8Array(sourceBytes.length);
        copiedBytes.set(sourceBytes);
        pcmBytes = copiedBytes;
      }
    }

    this.inferenceAbort = null;
    this.activeBackend = null;
    this.resolvedLanguage = null;
    this.recordingStartMs = 0;

    if (result === null) {
      return { status: 'cancelled' };
    }

    const transcriptionDurationMs = Date.now() - inferenceStartMs;
    const engineLabel = (await this.modelRepository.getActiveModel()).definition.label;

    return {
      status: 'completed',
      submission: {
        sessionId: request.sessionId,
        text: result.text,
        detectedLanguage: result.detectedLanguage,
        audioDurationSeconds,
        transcriptionDurationMs,
        transcriptionEngineLabel: engineLabel,
        pcm: pcmBytes,
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

    const pipeline = this.pipeline;
    this.pipeline = null;
    if (pipeline !== null) {
      await pipeline.release();
    }
  }
}
