import { ipc } from '@mobrowser/api';
import {
  RecordingService as createRecordingService,
  type RecordingService as RecordingServiceInterface,
} from '../gen/ipc_service';
import type { CancelRecordingRequest, PastePartialTranscriptionRequest, StopRecordingRequest, SubmitTranscriptionRequest } from '../gen/recording';
import type { SettingsStore } from '../settings/SettingsStore';
import type { HistoryStore, SessionRecord } from '../history/HistoryStore';
import type { SessionStorage } from './SessionStorage';
import { RecordingSession } from './RecordingSession';

export type RecordingState = 'idle' | 'recording' | 'processing';

/** Callback fired once per successfully completed transcription. */
export type TranscriptionCompletedCallback = (text: string) => void;

/** Callback fired for each partial transcription chunk during streaming. */
export type PartialTranscriptionCallback = (text: string) => void;

/**
 * Controls the recording session lifecycle: idle, recording, processing, and back to idle.
 */
export class RecordingSessionController {
  private state: RecordingState = 'idle';
  private session: RecordingSession | null = null;

  private readonly listeners: ((state: RecordingState) => void)[] = [];
  private readonly completionListeners: TranscriptionCompletedCallback[] = [];
  private readonly partialListeners: PartialTranscriptionCallback[] = [];

  constructor(
    private readonly settings: SettingsStore,
    private readonly historyStore: HistoryStore,
    private readonly sessionStorage: SessionStorage,
  ) {}

  /**
   * Returns the current FSM state.
   */
  getState(): RecordingState {
    return this.state;
  }

  /**
   * Registers a callback that fires on every state transition.
   *
   * @returns an unsubscribe function.
   */
  onStateChange(cb: (state: RecordingState) => void): () => void {
    this.listeners.push(cb);
    return () => {
      const idx = this.listeners.indexOf(cb);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  /**
   * Registers a callback that fires when a transcription is successfully
   * submitted. Receives the transcribed text and the bundle ID of the app
   * that was frontmost when recording started.
   */
  onTranscriptionCompleted(cb: TranscriptionCompletedCallback): void {
    this.completionListeners.push(cb);
  }

  /**
   * Registers a callback that fires for each partial transcription chunk
   * received during a streaming session.
   */
  onPartialTranscription(cb: PartialTranscriptionCallback): void {
    this.partialListeners.push(cb);
  }

  /**
   * Forwards a partial transcription chunk to all registered partial listeners.
   *
   * Returns false if the session ID does not match the active session.
   */
  pastePartialTranscription(payload: PastePartialTranscriptionRequest): boolean {
    if (this.session?.id !== payload.sessionId) return false;
    for (const cb of this.partialListeners) {
      cb(payload.text);
    }
    return true;
  }

  /**
   * Toggles recording: starts if idle, stops if recording. No-op while processing.
   */
  toggle(): void {
    if (this.state === 'idle') {
      this.start();
    } else if (this.state === 'recording') {
      this.stop();
    }
  }

  /**
   * Starts a recording session.
   *
   * No-op if already recording or processing.
   */
  start(): void {
    if (this.state !== 'idle') return;

    const settings = this.settings.get();
    this.session = new RecordingSession(
      settings.dontSaveAudio,
      settings.dontSaveTranscripts,
    );

    this.transition('recording');
  }

  /**
   * Transitions from recording to processing.
   */
  stop(): void {
    if (this.state !== 'recording') return;
    this.transition('processing');
  }

  /**
   * Cancels the current session and returns to idle.
   */
  cancel(): void {
    if (this.state === 'idle') return;
    this.session = null;
    this.transition('idle');
  }

  /**
   * Completes the current session: persists to history, saves files if applicable,
   * and transitions to idle.
   *
   * Returns false if the session ID does not match the active session (stale result).
   */
  async completeTranscription(payload: SubmitTranscriptionRequest): Promise<boolean> {
    if (this.state !== 'processing') return false;
    if (this.session?.id !== payload.sessionId) {
      console.warn('[RecordingSessionController] completeTranscription: session ID mismatch, ignoring.');
      return false;
    }

    const session = this.session;
    const wordCount = this.countWords(payload.text);

    const record: SessionRecord = {
      id: session.id,
      startedAt: session.startedAt,
      transcriptionEngineLabel: payload.transcriptionEngineLabel,
      audioDurationSeconds: payload.audioDurationSeconds,
      transcriptionDurationMs: payload.transcriptionDurationMs,
      wordCount,
      transcriptionText: session.dontSaveTranscripts ? null : payload.text,
      detectedLanguage: payload.detectedLanguage,
    };

    await this.historyStore.addSession(record);

    if (!session.dontSaveAudio) {
      await this.sessionStorage.saveAudio(session.id, payload.pcm);
    }

    if (!session.dontSaveTranscripts) {
      await this.sessionStorage.saveTranscript(session.id, payload.text);
    }

    this.session = null;

    if (!payload.streamed) {
      for (const cb of this.completionListeners) {
        cb(payload.text);
      }
    }

    this.transition('idle');
    return true;
  }

  /**
   * Returns the active session, or null when idle.
   */
  getActiveSession(): RecordingSession | null {
    return this.session;
  }

  private transition(next: RecordingState): void {
    this.state = next;
    for (const cb of this.listeners) {
      cb(next);
    }
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter(Boolean).length;
  }

}

/**
 * Registers the Recording IPC service.
 *
 * Handles both CancelRecording and SubmitTranscription, delegating
 * state transitions and persistence to RecordingSessionController.
 */
export function registerRecordingIpc(controller: RecordingSessionController): void {
  ipc.registerService(createRecordingService(new RecordingService(controller)));
}

class RecordingService implements RecordingServiceInterface {
  constructor(private readonly controller: RecordingSessionController) {}

  CancelRecording(_request: CancelRecordingRequest) {
    this.controller.cancel();
    return Promise.resolve({});
  }

  async SubmitTranscription(request: SubmitTranscriptionRequest) {
    await this.controller.completeTranscription(request);
    return {};
  }

  PastePartialTranscription(request: PastePartialTranscriptionRequest) {
    this.controller.pastePartialTranscription(request);
    return Promise.resolve({});
  }

  StopRecording(request: StopRecordingRequest) {
    if (this.controller.getActiveSession()?.id === request.sessionId) {
      this.controller.stop();
    }
    return Promise.resolve({});
  }
}
