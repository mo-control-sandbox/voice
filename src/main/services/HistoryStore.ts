import * as fs from 'node:fs';
import * as path from 'node:path';
import { desktop } from '@mobrowser/api';
import type { SessionRecord } from '../../shared/types';
import type { SessionFileManager } from './SessionFileManager';

/**
 * Persists the chronological list of all completed recording sessions.
 * The in-memory array is the authoritative state; `history.json` is written
 * synchronously after every mutation to prevent data loss on crash.
 */
export class HistoryStore {
  private readonly historyPath: string;
  private sessions: SessionRecord[] = [];

  constructor(
    userDataPath: string,
    private readonly sessionFileManager: SessionFileManager,
  ) {
    this.historyPath = path.join(userDataPath, 'history.json');
  }

  /** Load history from disk. Creates an empty `history.json` when none exists. */
  initialize(): void {
    if (!fs.existsSync(this.historyPath)) {
      fs.writeFileSync(this.historyPath, '[]', 'utf8');
    }
    const raw = fs.readFileSync(this.historyPath, 'utf8');
    this.sessions = JSON.parse(raw) as SessionRecord[];
  }

  /** Append a completed session record and persist immediately. */
  addSession(record: SessionRecord): void {
    this.sessions.push(record);
    this.persist();
  }

  /** Return a frozen snapshot of all sessions in chronological order. */
  getSessions(): SessionRecord[] {
    return Object.freeze([...this.sessions]) as SessionRecord[];
  }

  /** Return the session with the given id, or `undefined` if it does not exist. */
  getSession(id: string): SessionRecord | undefined {
    return this.sessions.find(s => s.id === id);
  }

  /** Delete a session's files from disk and remove its record from history. */
  async deleteSession(id: string): Promise<void> {
    await this.sessionFileManager.deleteSessionFiles(id);
    this.sessions = this.sessions.filter(s => s.id !== id);
    this.persist();
  }

  /** Open the audio file for a session in Finder. No-op when audio was not saved. */
  revealAudioFile(id: string): void {
    const session = this.getSession(id);
    if (session?.audioPath != null) {
      desktop.showPath(session.audioPath);
    }
  }

  /** Open the transcript file for a session in Finder. No-op when transcript was not saved. */
  revealTranscriptFile(id: string): void {
    const session = this.getSession(id);
    if (session?.transcriptPath != null) {
      desktop.showPath(session.transcriptPath);
    }
  }

  private persist(): void {
    fs.writeFileSync(this.historyPath, JSON.stringify(this.sessions, null, 2), 'utf8');
  }
}
