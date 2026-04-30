import * as fs from 'node:fs';
import * as path from 'node:path';
import { app, desktop, ipc } from '@mobrowser/api';
import { Mutex } from 'async-mutex';
import { HistoryService as createHistoryService, type HistoryService as HistoryServiceInterface } from '../gen/ipc_service';
import type { DeleteSessionRequest, GetSessionsRequest, SessionIdRequest } from '../gen/history';
import type { SessionStorage } from '../recording/SessionStorage';

/**
 * A completed transcription session.
 */
export interface TranscriptionSession {
  readonly id: string;
  readonly startedAt: number;
  readonly transcriptionEngineLabel: string;
  readonly audioDurationSeconds: number;
  readonly wordCount: number;
  readonly transcriptionText: string | null;
  readonly detectedLanguage: string;
}

/**
 * The persistent store for completed transcription sessions.
 */
export class HistoryStore {
  private readonly historyPath: string;
  private sessions: TranscriptionSession[] = [];
  private readonly persistMutex = new Mutex();
  private readonly changeListeners = new Set<() => void>();

  constructor(private readonly sessionStorage: SessionStorage) {
    this.historyPath = path.join(app.getPath('userData'), 'history.json');
  }

  /**
   * Loads persisted sessions from disk.
   */
  async initialize(): Promise<void> {
    try {
      const raw = await fs.promises.readFile(this.historyPath, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.sessions = parsed as TranscriptionSession[];
      } else {
        console.warn('[HistoryStore] history.json root payload must be an array; ignoring stored history.');
      }
    } catch (err) {
      if (isFileMissingError(err)) {
        return;
      }
      console.error('[HistoryStore] Failed to read history.json:', err);
    }
  }

  /**
   * All session records in insertion order.
   */
  getSessions(): TranscriptionSession[] {
    return [...this.sessions];
  }

  /**
   * The session record with the given ID, or null if not found.
   */
  getSession(id: string): TranscriptionSession | null {
    return this.sessions.find((s) => s.id === id) ?? null;
  }

  /**
   * Appends a session record and persists the updated list to disk.
   */
  async addSession(record: TranscriptionSession): Promise<void> {
    this.sessions.push(record);
    await this.persist();
    this.notifyChanged();
  }

  /**
   * Removes the session record and its on-disk audio and transcript files.
   */
  async deleteSession(id: string): Promise<void> {
    const index = this.sessions.findIndex((s) => s.id === id);
    if (index === -1) return;
    this.sessions.splice(index, 1);
    await this.persist();
    await this.sessionStorage.deleteSessionFiles(id);
    this.notifyChanged();
  }

  /**
   * Registers a callback that is invoked after history mutations.
   */
  onChanged(listener: () => void): void {
    this.changeListeners.add(listener);
  }

  /**
   * Unregisters a previously registered change callback.
   */
  offChanged(listener: () => void): void {
    this.changeListeners.delete(listener);
  }

  /**
   * Opens the session's storage directory in file explorer.
   */
  revealSessionFolder(id: string): void {
    const dir = this.sessionStorage.getSessionDir(id);
    if (this.sessionStorage.fileExists(dir)) {
      desktop.showPath(dir);
    }
  }

  private persist(): Promise<void> {
    const payload = JSON.stringify(this.sessions, null, 2);
    return this.persistMutex.runExclusive(async () => {
        try {
          await fs.promises.writeFile(this.historyPath, payload, 'utf8');
        } catch (err) {
          console.error('[HistoryStore] Failed to write history.json:', err);
        }
      });
  }

  private notifyChanged(): void {
    for (const listener of this.changeListeners) {
      listener();
    }
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFileMissingError(value: unknown): value is NodeJS.ErrnoException {
  return isObject(value) && value.code === 'ENOENT';
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

  RevealSessionFolder(request: SessionIdRequest) {
    this.historyStore.revealSessionFolder(request.id);
    return Promise.resolve({});
  }
}
