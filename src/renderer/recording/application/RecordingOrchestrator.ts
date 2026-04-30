import type { RecordingSignalSnapshotProto } from '../../gen/reverse_ipc_bridge';
import type { RecordingGateway } from './RecordingGateway';
import type { RecordingState, RecordingViewState } from './RecordingState';
import type { TranscriptionService } from './TranscriptionService';

const AUDIO_START_FAILURE_DISMISS_MS = 2000;

/**
 * Coordinates recording lifecycle transitions between signal snapshots and services.
 */
export class RecordingOrchestrator {
  /**
   * Last observed session identifier from recording signal snapshots.
   */
  private lastSessionId = '';

  /**
   * Last observed lifecycle state from recording signal snapshots.
   */
  private lastState: RecordingState = 'idle';

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

  constructor(
    private readonly gateway: RecordingGateway,
    private readonly transcriptionService: TranscriptionService,
  ) {}

  /**
   * Starts orchestrator signal subscription and emits view-state updates.
   */
  start(onStateChanged: (state: RecordingViewState) => void): () => void {
    this.stateCallback = onStateChanged;
    let active = true;

    const unregister = this.gateway.subscribeRecordingSignals(async (next) => {
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
      await this.gateway.cancelRecording({ sessionId, reason: 'USER_CANCELLED' });
    })();
  }

  /**
   * Applies one recording snapshot update and executes required side effects.
   */
  private async handleRecordingChanged(next: RecordingSignalSnapshotProto): Promise<void> {
    const prevSessionId = this.lastSessionId;
    const prevState = this.lastState;
    const nextState = this.toRecordingState(next.state);

    const sessionChanged = next.sessionId !== '' && next.sessionId !== prevSessionId;
    const stateChanged = nextState !== prevState;

    this.lastSessionId = next.sessionId;
    this.lastState = nextState;
    this.notifyState();

    if (sessionChanged || (stateChanged && nextState === 'recording')) {
      const settings = await this.gateway.getSettings();
      const sessionId = next.sessionId;
      const onAudioChunk = next.saveAudio
        ? (pcm: Uint8Array) => { void this.gateway.appendAudioChunk(sessionId, pcm); }
        : (_pcm: Uint8Array) => undefined;

      const startResult = await this.transcriptionService.startCapture({
        sessionId,
        audioInputDeviceId: settings.audioInputDeviceId,
        onTrackEnded: () => {
          void this.gateway.cancelRecording({
            sessionId,
            reason: 'DEVICE_DISCONNECTED',
          });
        },
        onPartialResult: (text) => {
          void this.gateway.pastePartialTranscription(sessionId, text);
        },
        onBatchMaxDurationReached: () => {
          void this.gateway.stopRecording({ sessionId });
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

    if (stateChanged && nextState === 'processing') {
      const processingPromise = this.transcriptionService.stopAndProcess({
        sessionId: next.sessionId,
      });
      this.notifyState();
      const processingResult = await processingPromise;

      if (processingResult.status === 'completed') {
        await this.gateway.submitTranscription(processingResult.submission);
      } else {
        await this.gateway.cancelRecording({ sessionId: next.sessionId, reason: 'CANCELLED' });
      }
      return;
    }

    if (stateChanged && nextState === 'idle') {
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
      void this.gateway.cancelRecording({ sessionId, reason: 'AUDIO_START_FAILED' });
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
   * Normalizes external snapshot state strings to supported lifecycle values.
   */
  private toRecordingState(value: string): RecordingState {
    if (value === 'recording' || value === 'processing' || value === 'idle') {
      return value;
    }
    return 'idle';
  }
}
