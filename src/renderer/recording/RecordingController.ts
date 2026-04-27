import { ipc } from '../gen/ipc';
import { AudioPipeline } from './audio/AudioPipeline';
import type { MoVoiceBackendFactory } from './services/MoVoiceBackendFactory';
import type { StreamingSession, TranscriptionBackend } from './services/TranscriptionBackend';
import type { RendererModelRepository } from '../services/RendererModelRepository';
import { reverseIpcBridge } from '../ipc/ReverseIpcBridge';
import { RecordingSignalService } from '../ipc/SignalService';

export type RecordingPhase = 'idle' | 'recording' | 'processing' | 'error';

const BATCH_MAX_DURATION_MS = 10 * 60 * 1000; // 10 minutes

/*
 * The subset of recording state that the view layer needs to render.
 * isAudioReady becomes true once AudioPipeline.start() resolves successfully,
 * enabling the waveform visualiser. errorMessage is non-null only when phase
 * is 'error'.
 */
export interface RecordingViewState {
  readonly phase: RecordingPhase;
  readonly isAudioReady: boolean;
  readonly errorMessage: string | null;
}

/** Maps a getUserMedia error to a short, user-readable sentence. */
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
 * Owns the recording session state machine and all side effects for the
 * recording window.
 *
 * Drives the full lifecycle: idle -> recording -> processing -> idle. Manages
 * the AudioPipeline, runs transcription inference, and submits results or
 * cancellation notices to the main process via IPC. The view layer interacts
 * only through start(), cancel(), and getWaveformData().
 */
export class RecordingController {
  private pipeline: AudioPipeline | null = null;
  private lastSessionId = '';
  private lastState = 'idle';
  private inferenceAbort: AbortController | null = null;
  private stateCallback: ((state: RecordingViewState) => void) | null = null;
  private errorMessage: string | null = null;
  private errorDismissTimer: ReturnType<typeof setTimeout> | null = null;
  private activeBackend: TranscriptionBackend | null = null;
  private streamingSession: StreamingSession | null = null;
  private resolvedLanguage: string | null = null;
  private recordingStartMs = 0;
  private batchMaxDurationTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly modelRepository: RendererModelRepository,
    private readonly backendFactory: MoVoiceBackendFactory,
  ) {}

  /**
   * Registers with the ReverseIpcBridge and begins reacting to recording
   * signal snapshots from the main process.
   *
   * @returns A cleanup function that unregisters the service and tears down
   *   any active pipeline. Pass this directly to useEffect.
   */
  start(onStateChanged: (state: RecordingViewState) => void): () => void {
    this.stateCallback = onStateChanged;
    let active = true;

    const unregister = reverseIpcBridge.registerService(
      RecordingSignalService({
        onRecordingChanged: async (next) => {
          if (!active) return;

          const prevSessionId = this.lastSessionId;
          const prevState = this.lastState;

          const sessionChanged = next.sessionId !== '' && next.sessionId !== prevSessionId;
          const stateChanged = next.state !== prevState;

          // Update tracking fields BEFORE any await so concurrent ticks do not
          // re-trigger the same transition while an async operation is in flight.
          this.lastSessionId = next.sessionId;
          this.lastState = next.state;
          this.notifyState();

          if (sessionChanged || (stateChanged && next.state === 'recording')) {
            const settings = await ipc.settings.GetSettings({});
            await this.startAudio(next.sessionId, settings.audioInputDeviceId);
          } else if (stateChanged && next.state === 'processing') {
            await this.stopAudioAndProcess(next.sessionId, next.dontSaveAudio);
          } else if (stateChanged && next.state === 'idle') {
            await this.cleanupPipeline();
          }
        },
      }),
    );

    return () => {
      active = false;
      this.stateCallback = null;
      unregister();
      void this.cleanupPipeline();
    };
  }

  /**
   * Cancels the active session. Releases the microphone immediately so the
   * OS indicator clears without waiting for the main-process round-trip.
   */
  cancel(): void {
    this.clearErrorDismiss();
    this.clearBatchMaxDurationTimer();
    const sessionId = this.lastSessionId;
    const pipeline = this.pipeline;
    const session = this.streamingSession;

    this.pipeline = null;
    this.streamingSession = null;
    this.activeBackend = null;
    this.inferenceAbort?.abort();
    this.inferenceAbort = null;
    this.resolvedLanguage = null;
    this.recordingStartMs = 0;
    this.errorMessage = null;
    this.notifyState();

    void (async () => {
      session?.cancel();
      await pipeline?.release();
      await ipc.recording.CancelRecording({ sessionId, reason: 'USER_CANCELLED' });
    })();
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private notifyState(): void {
    const phase: RecordingPhase = this.errorMessage !== null
      ? 'error'
      : (this.lastState as RecordingPhase);
    this.stateCallback?.({
      phase,
      isAudioReady: this.pipeline !== null,
      errorMessage: this.errorMessage,
    });
  }

  private clearBatchMaxDurationTimer(): void {
    if (this.batchMaxDurationTimer !== null) {
      clearTimeout(this.batchMaxDurationTimer);
      this.batchMaxDurationTimer = null;
    }
  }

  private clearErrorDismiss(): void {
    if (this.errorDismissTimer !== null) {
      clearTimeout(this.errorDismissTimer);
      this.errorDismissTimer = null;
    }
  }

  private async startAudio(sessionId: string, deviceId: string): Promise<void> {
    await this.cleanupPipeline();

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
      void ipc.recording.CancelRecording({ sessionId, reason: 'DEVICE_DISCONNECTED' });
    });

    try {
      // Streaming backends run the AudioContext at 16 kHz so the OS resamples
      // before chunks reach the worklet -- no OfflineAudioContext step needed.
      const pipelineSampleRate = backend.mode === 'streaming' ? 16000 : undefined;
      await pipeline.start(deviceId, pipelineSampleRate);

      // A concurrent cleanup or new session may have replaced this.pipeline
      // while start() was awaited. Release and bail if so.
      if (this.pipeline !== pipeline) {
        await pipeline.release();
        return;
      }

      if (backend.mode === 'streaming') {
        const session = backend.beginSession(this.resolvedLanguage, abortController.signal);
        this.streamingSession = session;
        pipeline.onChunk((chunk) => { session.pushChunk(chunk); });
        session.onPartialResult((text) => {
          void ipc.recording.PastePartialTranscription({ sessionId, text });
        });
      } else {
        this.batchMaxDurationTimer = setTimeout(() => {
          this.batchMaxDurationTimer = null;
          void ipc.recording.StopRecording({ sessionId });
        }, BATCH_MAX_DURATION_MS);
      }

      this.recordingStartMs = Date.now();
      this.notifyState();
    } catch (err) {
      console.error('[RecordingController] Failed to start audio:', err);
      this.pipeline = null;
      this.activeBackend = null;
      this.inferenceAbort = null;
      await pipeline.release();
      this.errorMessage = classifyAudioError(err);
      this.notifyState();
      this.errorDismissTimer = setTimeout(() => {
        this.errorMessage = null;
        this.errorDismissTimer = null;
        void ipc.recording.CancelRecording({ sessionId, reason: 'AUDIO_START_FAILED' });
      }, 2000);
    }
  }

  private async stopAudioAndProcess(sessionId: string, dontSaveAudio: boolean): Promise<void> {
    this.clearBatchMaxDurationTimer();
    const pipeline = this.pipeline;
    const session = this.streamingSession;
    const backend = this.activeBackend;
    const language = this.resolvedLanguage;
    // inferenceAbort is always set by startAudio before this method runs.
    const abortController = this.inferenceAbort as AbortController;

    this.pipeline = null;
    this.streamingSession = null;
    this.notifyState();

    const recordingStopMs = Date.now();
    const inferenceStartMs = recordingStopMs;
    let result;
    let audioDurationSeconds: number;
    let pcmBytes: Uint8Array;

    if (session !== null) {
      // Streaming path: mic release and session finalization run concurrently.
      // The session already has all audio via pushChunk -- pipeline.release()
      // just tears down the AudioContext and clears the OS mic indicator.
      const [transcriptionResult] = await Promise.all([
        session.finalize(),
        pipeline?.release(),
      ]);
      result = transcriptionResult;
      audioDurationSeconds = (recordingStopMs - this.recordingStartMs) / 1000;
      pcmBytes = new Uint8Array(0);
    } else {
      // Batch path: resample the full accumulated buffer, then run inference.
      const audio = pipeline !== null
        ? await pipeline.stop()
        : { samples: new Float32Array(0), sampleRate: 16000, channelCount: 1 };

      audioDurationSeconds = audio.samples.length / audio.sampleRate;

      if (backend !== null && backend.mode === 'batch') {
        result = await backend.transcribe(audio, language, abortController.signal);
      } else {
        result = null;
      }

      pcmBytes = dontSaveAudio
        ? new Uint8Array(0)
        : new Uint8Array(audio.samples.buffer, audio.samples.byteOffset, audio.samples.byteLength);
    }

    this.inferenceAbort = null;
    this.activeBackend = null;
    this.resolvedLanguage = null;
    this.recordingStartMs = 0;

    const transcriptionDurationMs = Date.now() - inferenceStartMs;
    const engineLabel = (await this.modelRepository.getActiveModel()).definition.label;

    if (result !== null) {
      await ipc.recording.SubmitTranscription({
        sessionId,
        text: result.text,
        detectedLanguage: result.detectedLanguage,
        audioDurationSeconds,
        transcriptionDurationMs,
        transcriptionEngineLabel: engineLabel,
        pcm: pcmBytes,
        streamed: session !== null,
      });
    } else {
      await ipc.recording.CancelRecording({ sessionId, reason: 'CANCELLED' });
    }
  }

  private async cleanupPipeline(): Promise<void> {
    this.clearErrorDismiss();
    this.clearBatchMaxDurationTimer();

    const session = this.streamingSession;
    this.streamingSession = null;
    session?.cancel();

    this.inferenceAbort?.abort();
    this.inferenceAbort = null;
    this.activeBackend = null;
    this.resolvedLanguage = null;
    this.recordingStartMs = 0;

    const hadError = this.errorMessage !== null;
    this.errorMessage = null;
    const pipeline = this.pipeline;
    if (pipeline !== null) {
      this.pipeline = null;
      this.notifyState();
      await pipeline.release();
    } else if (hadError) {
      this.notifyState();
    }
  }
}
