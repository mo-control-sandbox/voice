import { ipc } from '@mobrowser/api';
import {
  RecordingService as createRecordingService,
  type RecordingService as RecordingServiceInterface,
} from '../gen/ipc_service';
import type { AppendAudioChunkRequest, CancelRecordingRequest, PastePartialTranscriptionRequest, StopRecordingRequest, SubmitTranscriptionRequest } from '../gen/recording';
import type { SettingsStore } from '../settings/SettingsStore';
import { AudioBuffer } from '../sessions/AudioBuffer';
import type { History, TranscriptionSession } from '../sessions/History';
import type { SessionStorage } from '../sessions/SessionStorage';
import { RecordingSession } from './RecordingSession';

export type RecordingState = 'idle' | 'recording' | 'processing';

/**
 * Callback fired once per successfully completed non-streaming transcription.
 */
export type TranscriptionCompletedCallback = (text: string) => void;

/**
 * Callback fired for each partial transcription chunk during streaming.
 */
export type PartialTranscriptionCallback = (text: string) => void;

/**
 * Runtime side-effect callbacks emitted by the recording session lifecycle.
 */
export type RecordingRuntimeListeners = {
  onTranscriptionCompleted?: TranscriptionCompletedCallback;
  onPartialTranscription?: PartialTranscriptionCallback;
  onSessionAborted?: () => void;
};

/**
 * Controls the recording session lifecycle: idle, recording, processing, and back to idle.
 */
export class RecordingSessionController {
  private state: RecordingState = 'idle';
  private session: RecordingSession | null = null;
  private audioBuffer: AudioBuffer | null = null;

  private readonly listeners: ((state: RecordingState) => void)[] = [];

  /**
   * Creates a recording session controller with persistence and settings dependencies.
   */
  constructor(
    private readonly settings: SettingsStore,
    private readonly historyStore: History,
    private readonly sessionStorage: SessionStorage,
    private readonly runtimeListeners: RecordingRuntimeListeners = {},
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
   * Forwards one partial transcription chunk to the runtime listener.
   *
   * Returns false if the session ID does not match the active session.
   */
  pastePartialTranscription(payload: PastePartialTranscriptionRequest): boolean {
    if (this.session?.id !== payload.sessionId) return false;
    this.runtimeListeners.onPartialTranscription?.(payload.text);
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
    this.audioBuffer = settings.dontSaveAudio ? null : new AudioBuffer();

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
   * Appends a raw PCM chunk to the active session's audio file on disk.
   *
   * Silently discarded when no session is active or the session IDs do not match.
   */
  appendAudioChunk(payload: AppendAudioChunkRequest): void {
    if (this.session?.id !== payload.sessionId) return;
    this.audioBuffer?.append(payload.pcm);
  }

  /**
   * Cancels the current session and returns to idle.
   */
  cancel(): void {
    if (this.state === 'idle') return;
    this.session = null;
    this.audioBuffer = null;
    this.runtimeListeners.onSessionAborted?.();
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

    const record: TranscriptionSession = {
      id: session.id,
      startedAt: session.startedAt,
      transcriptionEngineLabel: payload.transcriptionEngineLabel,
      audioDurationSeconds: payload.audioDurationSeconds,
      wordCount,
      transcriptionText: session.dontSaveTranscripts ? null : payload.text,
      detectedLanguage: payload.detectedLanguage,
    };

    await this.historyStore.addSession(record);

    if (!session.dontSaveAudio && this.audioBuffer !== null) {
      await this.sessionStorage.saveAudio(session.id, this.audioBuffer.toWavBytes());
    }

    if (!session.dontSaveTranscripts) {
      await this.sessionStorage.saveTranscript(session.id, payload.text);
    }

    this.session = null;
    this.audioBuffer = null;

    if (!payload.streamed) {
      this.runtimeListeners.onTranscriptionCompleted?.(payload.text);
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

  AppendAudioChunk(request: AppendAudioChunkRequest) {
    this.controller.appendAudioChunk(request);
    return Promise.resolve({});
  }
}
