import { ipc } from '../gen/ipc';
import { AudioPipeline } from './audio/AudioPipeline';
import type { PcmAudio } from './audio/PcmAudio';
import type { MoVoiceBackendFactory } from './services/MoVoiceBackendFactory';
import { TranscriptionOrchestrator } from './services/TranscriptionOrchestrator';
import type { RendererModelRepository } from '../services/RendererModelRepository';
import { reverseIpcBridge } from '../ipc/ReverseIpcBridge';
import { RecordingSignalService } from '../ipc/SignalService';

export type RecordingPhase = 'idle' | 'recording' | 'processing' | 'error';

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
      this.inferenceAbort?.abort();
      void this.cleanupPipeline();
    };
  }

  /**
   * Cancels the active session. Releases the microphone immediately so the
   * OS indicator clears without waiting for the main-process round-trip.
   */
  cancel(): void {
    this.clearErrorDismiss();
    const sessionId = this.lastSessionId;
    const pipeline = this.pipeline;
    this.pipeline = null;
    this.errorMessage = null;
    this.notifyState();
    void (async () => {
      await pipeline?.release();
      await ipc.recording.CancelRecording({ sessionId, reason: 'USER_CANCELLED' });
    })();
  }

  /**
   * Current time-domain waveform snapshot for the visualiser. Returns an empty
   * array when no pipeline is active.
   */
  getWaveformData(): Float32Array {
    return this.pipeline?.getWaveformData() ?? new Float32Array(0);
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

  private clearErrorDismiss(): void {
    if (this.errorDismissTimer !== null) {
      clearTimeout(this.errorDismissTimer);
      this.errorDismissTimer = null;
    }
  }

  private async startAudio(sessionId: string, deviceId: string): Promise<void> {
    await this.cleanupPipeline();

    const pipeline = new AudioPipeline();
    this.pipeline = pipeline;

    pipeline.onTrackEnded(() => {
      void ipc.recording.CancelRecording({ sessionId, reason: 'DEVICE_DISCONNECTED' });
    });

    try {
      await pipeline.start(deviceId);
      // A concurrent cleanup or new session may have replaced this.pipeline
      // while start() was awaited. Release and bail if so.
      if (this.pipeline !== pipeline) {
        await pipeline.release();
        return;
      }
      this.notifyState();
    } catch (err) {
      console.error('[RecordingController] Failed to start audio:', err);
      this.pipeline = null;
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
    const pipeline = this.pipeline;
    this.pipeline = null;
    this.notifyState();

    let audio: PcmAudio;
    if (pipeline !== null) {
      audio = await pipeline.stop();
    } else {
      audio = { samples: new Float32Array(0), sampleRate: 16000, channelCount: 1 };
    }

    const inferenceStartMs = Date.now();
    const activeModel = await this.modelRepository.getActiveModel();

    const language = activeModel.definition.isBuiltin
      ? null
      : (activeModel.definition.isMultilingual ? this.modelRepository.getLanguage() : null);

    const backend = this.backendFactory.createBackend(activeModel.definition);

    const abortController = new AbortController();
    this.inferenceAbort = abortController;

    const orchestrator = new TranscriptionOrchestrator(backend);
    const result = await orchestrator.transcribe(
      audio,
      language === 'auto' ? null : (language ?? null),
      abortController.signal,
    );
    this.inferenceAbort = null;

    const transcriptionDurationMs = Date.now() - inferenceStartMs;
    const audioDurationSeconds = audio.samples.length / audio.sampleRate;

    if (result !== null) {
      const engineLabel = activeModel.definition.isBuiltin
        ? 'Built-in'
        : activeModel.definition.label;

      const pcmBytes = dontSaveAudio
        ? new Uint8Array(0)
        : new Uint8Array(
            audio.samples.buffer,
            audio.samples.byteOffset,
            audio.samples.byteLength,
          );

      await ipc.recording.SubmitTranscription({
        sessionId,
        text: result.text,
        detectedLanguage: result.detectedLanguage,
        audioDurationSeconds,
        transcriptionDurationMs,
        transcriptionEngineLabel: engineLabel,
        pcm: pcmBytes,
      });
    } else {
      await ipc.recording.CancelRecording({ sessionId, reason: 'CANCELLED' });
    }
  }

  private async cleanupPipeline(): Promise<void> {
    this.clearErrorDismiss();
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
