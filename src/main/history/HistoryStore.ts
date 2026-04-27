import * as fs from 'node:fs/promises';
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
  private revision = 0;
  private persistQueue: Promise<void> = Promise.resolve();

  constructor(private readonly sessionStorage: SessionStorage) {
    this.historyPath = path.join(app.getPath('userData'), 'history.json');
  }

  /**
   * Loads persisted sessions from disk.
   */
  async initialize(): Promise<void> {
    try {
      const raw = await fs.readFile(this.historyPath, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const sanitized = parsed.filter(isSessionRecord);
        if (sanitized.length !== parsed.length) {
          console.warn('[HistoryStore] history.json contains invalid session records; ignoring malformed entries.');
        }
        this.sessions = sanitized;
        if (sanitized.length !== parsed.length) {
          await this.persist();
        }
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
   * Monotonically increasing counter incremented on every mutation.
   */
  getRevision(): number {
    return this.revision;
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
  async addSession(record: SessionRecord): Promise<void> {
    this.sessions.push(record);
    this.revision++;
    await this.persist();
  }

  /**
   * Removes the session record and its on-disk audio and transcript files.
   */
  async deleteSession(id: string): Promise<void> {
    const index = this.sessions.findIndex((s) => s.id === id);
    if (index === -1) return;
    this.sessions.splice(index, 1);
    this.revision++;
    await this.persist();
    await this.sessionStorage.deleteSessionFiles(id);
  }

  /**
   * Opens the session's storage directory in Finder.
   *
   * Falls back to the audio file when the directory itself cannot be shown
   * directly, and is a no-op when no files for the session exist yet.
   */
  revealSessionFolder(id: string): void {
    const dir = this.sessionStorage.getSessionDir(id);
    if (this.sessionStorage.fileExists(dir)) {
      desktop.showPath(dir);
    }
  }

  private persist(): Promise<void> {
    const payload = JSON.stringify(this.sessions, null, 2);
    this.persistQueue = this.persistQueue
      .catch(() => undefined)
      .then(async () => {
        try {
          await fs.writeFile(this.historyPath, payload, 'utf8');
        } catch (err) {
          console.error('[HistoryStore] Failed to write history.json:', err);
        }
      });
    return this.persistQueue;
  }
}

function isSessionRecord(value: unknown): value is SessionRecord {
  if (!isObject(value)) return false;
  return typeof value.id === 'string'
    && typeof value.startedAt === 'number'
    && Number.isFinite(value.startedAt)
    && typeof value.transcriptionEngineLabel === 'string'
    && typeof value.audioDurationSeconds === 'number'
    && Number.isFinite(value.audioDurationSeconds)
    && typeof value.transcriptionDurationMs === 'number'
    && Number.isFinite(value.transcriptionDurationMs)
    && typeof value.wordCount === 'number'
    && Number.isInteger(value.wordCount)
    && value.wordCount >= 0
    && (typeof value.transcriptionText === 'string' || value.transcriptionText === null)
    && typeof value.detectedLanguage === 'string';
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

  RevealSessionFolder(request: SessionIdRequest) {
    this.historyStore.revealSessionFolder(request.id);
    return Promise.resolve({});
  }
}
