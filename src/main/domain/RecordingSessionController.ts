import type {
  CapturedApp,
  PasteResult,
  RecordingState,
  SessionRecord,
  TranscriptionResult,
  TranscriptionService,
} from '../../shared/types';
import type { HistoryStore } from '../services/HistoryStore';
import type { PreferencesService } from '../services/PreferencesService';
import type { SessionFileManager } from '../services/SessionFileManager';
import type { native as NativeBindings } from '../gen/native';
import { createRecordingSession, type RecordingSession } from './RecordingSession';

const AUDIO_SAMPLE_RATE = 16_000;

/** Writes text to the clipboard and activates the target app to trigger a paste. */
export interface PasteCoordinator {
  /** Write `text` to the clipboard and activate `target` to trigger a paste. */
  paste(text: string, target: CapturedApp): Promise<PasteResult>;
}

/** Surfaces pipeline error conditions to the user. */
export interface Notifier {
  /** Called when recording cannot start because microphone permission is denied. */
  microphonePermissionDenied(): void;
  /** Called when the paste step fails because accessibility permission is denied. */
  pasteAccessibilityDenied(): void;
}

/**
 * Owns the recording FSM and orchestrates the full voice-to-text pipeline:
 * audio capture → transcription → paste → history persistence.
 *
 * FSM states: `idle` → `recording` → `processing` → `idle`
 * Cancellation is possible from both `recording` and `processing`.
 */
export class RecordingSessionController {
  private state: RecordingState = 'idle';
  private currentSession: RecordingSession | null = null;
  private readonly stateChangeCallbacks: Array<(state: RecordingState) => void> = [];

  constructor(
    private readonly transcriptionService: TranscriptionService,
    private readonly pasteCoordinator: PasteCoordinator,
    private readonly historyStore: HistoryStore,
    private readonly sessionFileManager: SessionFileManager,
    private readonly preferences: PreferencesService,
    private readonly native: typeof NativeBindings,
    private readonly notifier: Notifier,
  ) {}

  /**
   * Transition from `idle` to `recording`.
   * Guards: microphone permission must be granted; no-op if not in `idle`.
   * Captures the frontmost app and snaps preference values into the session.
   */
  async start(): Promise<void> {
    if (this.state !== 'idle') return;

    const permissionsResponse = await this.native.systemPermissions.GetPermissionsStatus({});
    const micPermission = permissionsResponse.permissions.find(p => p.type === 'microphone');
    if (micPermission?.status !== 'granted') {
      this.notifier.microphonePermissionDenied();
      return;
    }

    const capturedAppResponse = await this.native.paste.CaptureFrontmostApp({});
    const capturedApp: CapturedApp = {
      bundleId: capturedAppResponse.bundleId,
      name: capturedAppResponse.name,
    };

    const rawLanguage = this.preferences.get('primaryLanguage');
    this.currentSession = createRecordingSession({
      capturedApp,
      language: rawLanguage === 'auto' ? null : rawLanguage,
      dontSaveAudio: this.preferences.get('dontSaveAudio'),
      dontSaveTranscripts: this.preferences.get('dontSaveTranscripts'),
    });

    this.transitionTo('recording');
  }

  /**
   * Transition from `recording` to `processing`.
   * No-op if not in `recording`.
   */
  stop(): void {
    if (this.state !== 'recording') return;
    this.transitionTo('processing');
  }

  /**
   * Abort the current session from any non-idle state.
   * No history entry is written; any in-flight transcription result is discarded.
   */
  cancel(): void {
    if (this.state === 'idle') return;
    this.currentSession = null;
    this.transitionTo('idle');
  }

  /**
   * Deliver recorded audio from the renderer after `stop()` has been called.
   * Runs the full pipeline: transcribe → paste → persist → idle.
   * If `cancel()` is called while transcription is in progress, the result is
   * discarded (state check after the await prevents paste and history write).
   */
  async submitAudio(pcm: Float32Array): Promise<void> {
    if (this.state !== 'processing' || this.currentSession === null) return;

    // Capture a local reference so cancellation (which nulls currentSession) does not
    // affect the values already in flight.
    const session = this.currentSession;

    let transcriptionResult: TranscriptionResult;
    const transcriptionStart = Date.now();
    try {
      transcriptionResult = await this.transcriptionService.transcribe(pcm, session.language);
    } catch {
      // Transcription failure: close the session without a history entry.
      if (this.state === 'processing') {
        this.currentSession = null;
        this.transitionTo('idle');
      }
      return;
    }
    const transcriptionDurationMs = Date.now() - transcriptionStart;

    // If cancel() was called while transcription ran, bail out without pasting.
    if (this.state !== 'processing') return;

    let audioPath: string | null = null;
    let transcriptPath: string | null = null;

    if (!session.dontSaveAudio) {
      await this.sessionFileManager.saveAudio(session.id, pcm);
      audioPath = this.sessionFileManager.getAudioPath(session.id);
    }

    if (!session.dontSaveTranscripts) {
      await this.sessionFileManager.saveTranscript(session.id, transcriptionResult.text);
      transcriptPath = this.sessionFileManager.getTranscriptPath(session.id);
    }

    const pasteResult = await this.pasteCoordinator.paste(transcriptionResult.text, session.capturedApp);
    if (!pasteResult.success && pasteResult.reason === 'accessibilityDenied') {
      this.notifier.pasteAccessibilityDenied();
    }

    const sessionRecord: SessionRecord = {
      id: session.id,
      timestamp: session.startedAt,
      transcriptionText: transcriptionResult.text,
      audioPath,
      transcriptPath,
      modelId: this.preferences.get('activeModelId'),
      language: session.language,
      detectedLanguage: transcriptionResult.detectedLanguage,
      audioDurationSeconds: pcm.length / AUDIO_SAMPLE_RATE,
      transcriptionDurationMs,
      targetAppName: session.capturedApp.name,
      audioSaved: !session.dontSaveAudio,
      transcriptSaved: !session.dontSaveTranscripts,
    };

    this.historyStore.addSession(sessionRecord);

    this.currentSession = null;
    this.transitionTo('idle');
  }

  getState(): RecordingState {
    return this.state;
  }

  onStateChange(callback: (state: RecordingState) => void): void {
    this.stateChangeCallbacks.push(callback);
  }

  private transitionTo(newState: RecordingState): void {
    this.state = newState;
    for (const cb of this.stateChangeCallbacks) {
      cb(newState);
    }
  }
}
