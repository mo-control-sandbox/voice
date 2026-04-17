import * as fs from 'node:fs';
import * as path from 'node:path';
import { app, desktop, ipc } from '@mobrowser/api';
import { HistoryService as createHistoryService, type HistoryService as HistoryServiceInterface } from '../gen/ipc_service';
import type { DeleteSessionRequest, GetSessionsRequest, SessionIdRequest } from '../gen/history';
import type { SessionStorage } from '../recording/SessionStorage';

/**
 * All persisted metadata for a completed transcription session.
 */
export interface SessionRecord {
  readonly id: string;
  readonly startedAt: number;
  readonly transcriptionEngineLabel: string;
  readonly audioDurationSeconds: number;
  readonly transcriptionDurationMs: number;
  readonly wordCount: number;
  readonly transcriptionText: string | null;
  readonly detectedLanguage: string;
}

/**
 * The persistent store for completed transcription sessions.
 */
export class HistoryStore {
  private sessions: SessionRecord[] = [];
  private readonly historyPath: string;

  constructor(private readonly sessionStorage: SessionStorage) {
    this.historyPath = path.join(app.getPath('userData'), 'history.json');
  }

  /**
   * Loads persisted sessions from disk.
   */
  initialize(): void {
    if (!fs.existsSync(this.historyPath)) return;
    try {
      const raw = fs.readFileSync(this.historyPath, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.sessions = parsed as SessionRecord[];
      }
    } catch (err) {
      console.error('[HistoryStore] Failed to read history.json:', err);
    }
  }

  /**
   * All session records in insertion order.
   */
  getSessions(): SessionRecord[] {
    return [...this.sessions];
  }

  /**
   * The session record with the given ID, or null if not found.
   */
  getSession(id: string): SessionRecord | null {
    return this.sessions.find((s) => s.id === id) ?? null;
  }

  /**
   * Appends a session record and persists the updated list to disk.
   */
  addSession(record: SessionRecord): void {
    this.sessions.push(record);
    this.persist();
  }

  /**
   * Removes the session record and its on-disk audio and transcript files.
   */
  async deleteSession(id: string): Promise<void> {
    const index = this.sessions.findIndex((s) => s.id === id);
    if (index === -1) return;
    this.sessions.splice(index, 1);
    this.persist();
    await this.sessionStorage.deleteSessionFiles(id);
  }

  /**
   * Opens Finder and selects the audio file for the given session.
   */
  revealAudioFile(id: string): void {
    const audioPath = this.sessionStorage.getAudioPath(id);
    if (this.sessionStorage.fileExists(audioPath)) {
      desktop.showPath(audioPath);
    }
  }

  /**
   * Opens Finder and selects the transcript file for the given session.
   * 
   * No-op when the file does not exist.
   */
  revealTranscriptFile(id: string): void {
    const transcriptPath = this.sessionStorage.getTranscriptPath(id);
    if (this.sessionStorage.fileExists(transcriptPath)) {
      desktop.showPath(transcriptPath);
    }
  }

  private persist(): void {
    try {
      fs.writeFileSync(this.historyPath, JSON.stringify(this.sessions, null, 2), 'utf8');
    } catch (err) {
      console.error('[HistoryStore] Failed to write history.json:', err);
    }
  }
}

/**
 * Registers the history IPC service.
 */
export function registerHistoryIpc(historyStore: HistoryStore, sessionStorage: SessionStorage): void {
  ipc.registerService(createHistoryService(new HistoryService(historyStore, sessionStorage)));
}

class HistoryService implements HistoryServiceInterface {
  constructor(
    private readonly historyStore: HistoryStore,
    private readonly sessionStorage: SessionStorage,
  ) {}

  GetSessions(_request: GetSessionsRequest) {
    const sessions = this.historyStore.getSessions().map((s) => ({
      id: s.id,
      startedAt: s.startedAt,
      transcriptionEngineLabel: s.transcriptionEngineLabel,
      audioDurationSeconds: s.audioDurationSeconds,
      transcriptionDurationMs: s.transcriptionDurationMs,
      wordCount: s.wordCount,
      transcriptionText: s.transcriptionText ?? '',
      detectedLanguage: s.detectedLanguage,
    }));
    return Promise.resolve({ sessions });
  }

  async DeleteSession(request: DeleteSessionRequest) {
    await this.historyStore.deleteSession(request.id);
    return {};
  }

  async GetAudioData(request: SessionIdRequest) {
    const bytes = await this.sessionStorage.readAudioBytes(request.id);
    return { audioData: Buffer.from(bytes ?? new Uint8Array(0)) };
  }

  RevealAudioFile(request: SessionIdRequest) {
    this.historyStore.revealAudioFile(request.id);
    return Promise.resolve({});
  }

  RevealTranscriptFile(request: SessionIdRequest) {
    this.historyStore.revealTranscriptFile(request.id);
    return Promise.resolve({});
  }
}
