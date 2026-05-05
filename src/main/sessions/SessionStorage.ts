import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from '@mobrowser/api';

export type SessionId = string;

/**
 * File-based storage for recording session data.
 */
export class SessionStorage {
  private sessionsDir(): string {
    return path.join(app.getPath('userData'), 'sessions');
  }

  /**
   * Returns the storage directory path for the given session.
   */
  getSessionDir(id: SessionId): string {
    return path.join(this.sessionsDir(), id);
  }

  /**
   * Returns the audio file path for the given session.
   */
  getAudioPath(id: SessionId): string {
    return path.join(this.getSessionDir(id), 'audio.wav');
  }

  /**
   * Returns the transcript file path for the given session.
   */
  getTranscriptPath(id: SessionId): string {
    return path.join(this.getSessionDir(id), 'transcript.txt');
  }

  async saveAudio(id: SessionId, audioData: Uint8Array): Promise<void> {
    const dir = this.getSessionDir(id);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(this.getAudioPath(id), audioData);
  }

  /**
   * Saves the transcript text for the given session.
   */
  async saveTranscript(id: SessionId, text: string): Promise<void> {
    const dir = this.getSessionDir(id);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(this.getTranscriptPath(id), text, 'utf8');
  }

  /**
   * Deletes all stored files for the given session.
   */
  async deleteSessionFiles(id: SessionId): Promise<void> {
    const dir = this.getSessionDir(id);
    await fs.promises.rm(dir, { recursive: true, force: true });
  }

  /**
   * Returns the audio bytes for the given session, or null if no audio was saved.
   */
  async readAudioBytes(id: SessionId): Promise<Uint8Array | null> {
    const audioPath = this.getAudioPath(id);
    if (!fs.existsSync(audioPath)) return null;
    const buffer = await fs.promises.readFile(audioPath);
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  /**
   * Returns audio metadata for the given session when an audio file exists.
   */
  async getAudioInfo(id: SessionId): Promise<{ hasAudio: boolean; totalBytes: number }> {
    const audioPath = this.getAudioPath(id);
    try {
      const stat = await fs.promises.stat(audioPath);
      if (!stat.isFile()) {
        return { hasAudio: false, totalBytes: 0 };
      }
      return { hasAudio: true, totalBytes: stat.size };
    } catch {
      return { hasAudio: false, totalBytes: 0 };
    }
  }

  /**
   * Returns one byte-range chunk for the session audio file.
   */
  async readAudioChunk(id: SessionId, offset: number, length: number): Promise<Uint8Array | null> {
    const audioPath = this.getAudioPath(id);
    let fileHandle: fs.promises.FileHandle | null = null;
    try {
      fileHandle = await fs.promises.open(audioPath, 'r');
      const out = new Uint8Array(length);
      const readResult = await fileHandle.read(out, 0, length, offset);
      if (readResult.bytesRead === 0) {
        return new Uint8Array(0);
      }
      return out.subarray(0, readResult.bytesRead);
    } catch {
      return null;
    } finally {
      await fileHandle?.close();
    }
  }

  /**
   * Checks whether the given path exists on disk.
   */
  fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }
}
