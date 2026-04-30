import { ipc } from '@mobrowser/api';
import {
  RecordingService as createRecordingService,
  type RecordingService as RecordingServiceInterface,
} from '../gen/ipc_service';
import type { AppendAudioChunkRequest, CancelRecordingRequest, PastePartialTranscriptionRequest, StopRecordingRequest, SubmitTranscriptionRequest } from '../gen/recording';
import type { SettingsStore } from '../settings/SettingsStore';
import type { History, TranscriptionSession } from '../sessions/History';
import type { SessionStorage } from '../sessions/SessionStorage';
import { RecordingSession } from './RecordingSession';

export type RecordingStatus = 'idle' | 'recording' | 'processing';

/**
 * Callback fired once per successfully completed non-streaming transcription.
 */
export type TranscriptionCompletedCallback = (text: string) => void;

/**
 * Callback fired for each partial transcription chunk during streaming.
 */
export type PartialTranscriptionCallback = (text: string) => void;

/**
 * Controls the recording session lifecycle: idle, recording, processing, and back to idle.
 */
export class RecordingSessionController {
  private stage: RecordingStatus = 'idle';
  private session: RecordingSession | null = null;

  private onStageChangeCallback: ((stage: RecordingStatus) => void) | null = null;
  private onSessionAbortedCallback: (() => void) | null = null;
  private onTranscribedCallback: TranscriptionCompletedCallback | null = null;
  private onPartiallyTranscribedCallback: PartialTranscriptionCallback | null = null;

  /**
   * Creates a recording session controller with persistence and settings dependencies.
   */
  constructor(
    private readonly settings: SettingsStore,
    private readonly historyStore: History,
    private readonly sessionStorage: SessionStorage,
  ) {}

  /**
   * Returns the current recording stage.
   */
  getState(): RecordingStatus {
    return this.stage;
  }

  /**
   * Registers a callback that fires when the recording stage changes.
   */
  onStateChange(cb: (stage: RecordingStatus) => void): void {
    this.onStageChangeCallback = cb;
  }

  /**
   * Registers a callback that fires after a completed non-streaming transcription.
   */
  onTranscribed(cb: TranscriptionCompletedCallback): void {
    this.onTranscribedCallback = cb;
  }

  /**
   * Registers a callback that fires for each streamed partial transcription.
   */
  onPartiallyTranscribed(cb: PartialTranscriptionCallback): void {
    this.onPartiallyTranscribedCallback = cb;
  }

  /**
   * Registers a callback that fires when the active session is canceled.
   */
  onSessionAborted(cb: () => void): void {
    this.onSessionAbortedCallback = cb;
  }

  /**
   * Forwards one partial transcription chunk to the runtime listener.
   */
  streamPartialResult(payload: PastePartialTranscriptionRequest): void {
    if (this.session?.id !== payload.sessionId) return;
    this.onPartiallyTranscribedCallback?.(payload.text);
  }

  /**
   * Starts a recording session.
   *
   * No-op if already recording or processing.
   */
  start(): void {
    if (this.stage !== 'idle') return;

    const settings = this.settings.get();
    this.session = new RecordingSession(
      settings.saveAudio,
      settings.saveTranscripts,
    );

    this.transition('recording');
  }

  /**
   * Transitions from recording to processing.
   */
  stop(): void {
    if (this.stage !== 'recording') return;
    this.transition('processing');
  }

  /**
   * Appends a raw PCM chunk to the active session's audio file on disk.
   *
   * Silently discarded when no session is active or the session IDs do not match.
   */
  appendAudioChunk(payload: AppendAudioChunkRequest): void {
    if (this.session?.id !== payload.sessionId) return;
    this.session.audioBuffer?.append(payload.pcm);
  }

  /**
   * Cancels the current session and returns to idle.
   */
  cancel(): void {
    if (this.stage === 'idle') return;
    this.session = null;
    this.onSessionAbortedCallback?.();
    this.transition('idle');
  }

  /**
   * Completes the current session: persists to history, saves files if applicable,
   * and transitions to idle.
   *
   * Returns false if the session ID does not match the active session (stale result).
   */
  async completeTranscription(payload: SubmitTranscriptionRequest): Promise<boolean> {
    if (this.stage !== 'processing') return false;
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
      transcriptionText: session.saveTranscripts ? payload.text : null,
      detectedLanguage: payload.detectedLanguage,
    };

    await this.historyStore.addSession(record);

    if (session.saveAudio && session.audioBuffer !== null) {
      await this.sessionStorage.saveAudio(session.id, session.audioBuffer.toWavBytes());
    }

    if (session.saveTranscripts) {
      await this.sessionStorage.saveTranscript(session.id, payload.text);
    }

    this.session = null;

    if (!payload.streamed) {
      this.onTranscribedCallback?.(payload.text);
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

  private transition(next: RecordingStatus): void {
    this.stage = next;
    this.onStageChangeCallback?.(next);
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter(Boolean).length;
  }

}

/**
 * Registers the Recording IPC service.
 *
 * Handles both CancelRecording and SubmitTranscription, delegating
 * recording lifecycle updates and persistence to RecordingSessionController.
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
    this.controller.streamPartialResult(request);
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
