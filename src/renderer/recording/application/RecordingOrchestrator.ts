import { ipc } from '../../gen/ipc';
import type { CancelRecordingRequest, StopRecordingRequest, SubmitTranscriptionRequest } from '../../gen/recording';
import { RecordingPhase, type RecordingState as RecordingSignalState } from '../../gen/reverse_ipc_bridge';
import type { RecordingViewState } from '../RecordingController';
import type { TranscriptionService } from './TranscriptionService';
import { PolledChannel } from '../../infra/ipc/PolledChannel';
import { SettingsService } from '../../settings/services/SettingsService';

const AUDIO_START_FAILURE_DISMISS_MS = 2000;
const RECORDING_POLL_INTERVAL_MS = 1000 / 30;

/**
 * Orchestrates one recording session lifecycle in the renderer.
 */
export class RecordingOrchestrator {
  private readonly settingsService = new SettingsService();
  private readonly recordingStateChannel = new PolledChannel<RecordingSignalState, string>({
    intervalMs: RECORDING_POLL_INTERVAL_MS,
    poll: async () => {
      const response = await ipc.reverseIpcBridge.PollRecording({});
      return response.recording;
    },
    getKey: (snapshot) => `${String(snapshot.phase)}:${snapshot.sessionId}`,
    logLabel: 'RecordingSignalChannel',
  });

  /**
   * Last observed session identifier from recording signal snapshots.
   */
  private lastSessionId = '';

  /**
   * Last observed lifecycle state from recording signal snapshots.
   */
  private lastState: RecordingPhase = RecordingPhase.RECORDING_PHASE_IDLE;

  /**
   * Current user-facing error message, when one is being displayed.
   */
  private errorMessage: string | null = null;

  /**
   * Timer used to auto-dismiss transient audio start failures.
   */
  private errorDismissTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Optional subscriber that receives view state updates.
   */
  private stateCallback: ((state: RecordingViewState) => void) | null = null;

  constructor(private readonly transcriptionService: TranscriptionService) {}

  /**
   * Starts orchestrator signal subscription and emits view-state updates.
   */
  start(onStateChanged: (state: RecordingViewState) => void): () => void {
    this.stateCallback = onStateChanged;
    let active = true;

    const unregister = this.recordingStateChannel.subscribe(async (next) => {
      if (!active) {
        return;
      }
      await this.handleRecordingChanged(next);
    });

    return () => {
      active = false;
      this.stateCallback = null;
      unregister();
      this.clearErrorDismiss();
      void this.transcriptionService.cleanup();
    };
  }

  /**
   * Cancels active recording work and requests main-process session cancellation.
   */
  cancel(): void {
    this.clearErrorDismiss();
    this.errorMessage = null;
    const sessionId = this.lastSessionId;
    const cancelPromise = this.transcriptionService.cancel();
    this.notifyState();

    void (async () => {
      await cancelPromise;
      await this.cancelRecording({ sessionId, reason: 'USER_CANCELLED' });
    })();
  }

  /**
   * Applies one recording snapshot update and executes required side effects.
   */
  private async handleRecordingChanged(next: RecordingSignalState): Promise<void> {
    const prevSessionId = this.lastSessionId;
    const prevState = this.lastState;
    const nextState = next.phase;

    const sessionChanged = next.sessionId !== '' && next.sessionId !== prevSessionId;
    const stateChanged = nextState !== prevState;

    this.lastSessionId = next.sessionId;
    this.lastState = nextState;
    this.notifyState();

    if (sessionChanged || (stateChanged && nextState === RecordingPhase.RECORDING_PHASE_RECORDING)) {
      const settings = await this.settingsService.getSettings();
      const sessionId = next.sessionId;
      const onAudioChunk = next.saveAudio
        ? (pcm: Uint8Array) => { void this.appendAudioChunk(sessionId, pcm); }
        : (_pcm: Uint8Array) => undefined;

      const startResult = await this.transcriptionService.startCapture({
        sessionId,
        audioInputDeviceId: settings.audioInputDeviceId,
        onTrackEnded: () => {
          void this.cancelRecording({
            sessionId,
            reason: 'DEVICE_DISCONNECTED',
          });
        },
        onPartialResult: (text) => {
          void this.streamPartialTranscription(sessionId, text);
        },
        onBatchMaxDurationReached: () => {
          void this.stopRecording({ sessionId });
        },
        onAudioChunk,
      });

      if (startResult.status === 'failed') {
        this.handleAudioStartFailure(next.sessionId, startResult.errorMessage);
      } else if (startResult.status === 'started') {
        this.notifyState();
      }
      return;
    }

    if (stateChanged && nextState === RecordingPhase.RECORDING_PHASE_PROCESSING) {
      const processingPromise = this.transcriptionService.stopAndProcess({
        sessionId: next.sessionId,
      });
      this.notifyState();
      const processingResult = await processingPromise;

      if (processingResult.status === 'completed') {
        await this.submitTranscription(processingResult.submission);
      } else {
        await this.cancelRecording({ sessionId: next.sessionId, reason: 'CANCELLED' });
      }
      return;
    }

    if (stateChanged && nextState === RecordingPhase.RECORDING_PHASE_IDLE) {
      const hadAudio = this.transcriptionService.isAudioReady;
      await this.transcriptionService.cleanup();
      const hadError = this.errorMessage !== null;
      this.errorMessage = null;
      if (hadAudio || hadError) {
        this.notifyState();
      }
    }
  }

  /**
   * Emits state for view subscribers using current orchestration and service data.
   */
  private notifyState(): void {
    const phase = this.errorMessage === null ? this.lastState : 'error';
    this.stateCallback?.({
      phase,
      isAudioReady: this.transcriptionService.isAudioReady,
      errorMessage: this.errorMessage,
    });
  }

  /**
   * Starts transient error display and schedules cancellation for failed startup.
   */
  private handleAudioStartFailure(sessionId: string, errorMessage: string): void {
    this.errorMessage = errorMessage;
    this.notifyState();
    this.clearErrorDismiss();
    this.errorDismissTimer = setTimeout(() => {
      this.errorDismissTimer = null;
      this.errorMessage = null;
      this.notifyState();
      void this.cancelRecording({ sessionId, reason: 'AUDIO_START_FAILED' });
    }, AUDIO_START_FAILURE_DISMISS_MS);
  }

  /**
   * Clears and removes an active transient error-dismiss timer.
   */
  private clearErrorDismiss(): void {
    if (this.errorDismissTimer !== null) {
      clearTimeout(this.errorDismissTimer);
      this.errorDismissTimer = null;
    }
  }

  /**
   * Sends a session cancellation request.
   */
  private async cancelRecording(request: CancelRecordingRequest): Promise<void> {
    await ipc.recording.CancelRecording(request);
  }

  /**
   * Sends a stop request for the provided session.
   */
  private async stopRecording(request: StopRecordingRequest): Promise<void> {
    await ipc.recording.StopRecording(request);
  }

  /**
   * Sends one partial transcription chunk.
   */
  private async streamPartialTranscription(sessionId: string, text: string): Promise<void> {
    await ipc.recording.PastePartialTranscription({ sessionId, text });
  }

  /**
   * Sends completed transcription payload.
   */
  private async submitTranscription(request: SubmitTranscriptionRequest): Promise<void> {
    await ipc.recording.SubmitTranscription(request);
  }

  /**
   * Sends a raw PCM chunk for incremental audio persistence.
   */
  private async appendAudioChunk(sessionId: string, pcm: Uint8Array): Promise<void> {
    await ipc.recording.AppendAudioChunk({ sessionId, pcm });
  }
}
