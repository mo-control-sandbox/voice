import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from '@mobrowser/api';
import { encodeWav } from './wav';

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
  getSessionDir(id: string): string {
    return path.join(this.sessionsDir(), id);
  }

  /**
   * Returns the audio file path for the given session.
   */
  getAudioPath(id: string): string {
    return path.join(this.getSessionDir(id), 'audio.wav');
  }

  /**
   * Returns the transcript file path for the given session.
   */
  getTranscriptPath(id: string): string {
    return path.join(this.getSessionDir(id), 'transcript.txt');
  }

  /**
   * Saves the recorded audio for the given session.
   */
  async saveAudio(id: string, pcm: Uint8Array): Promise<void> {
    const dir = this.getSessionDir(id);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(this.getAudioPath(id), encodeWav(pcm));
  }

  /**
   * Saves the transcript text for the given session.
   */
  async saveTranscript(id: string, text: string): Promise<void> {
    const dir = this.getSessionDir(id);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(this.getTranscriptPath(id), text, 'utf8');
  }

  /**
   * Deletes all stored files for the given session.
   */
  async deleteSessionFiles(id: string): Promise<void> {
    const dir = this.getSessionDir(id);
    await fs.promises.rm(dir, { recursive: true, force: true });
  }

  /**
   * Returns the audio bytes for the given session, or null if no audio was saved.
   */
  async readAudioBytes(id: string): Promise<Uint8Array | null> {
    const audioPath = this.getAudioPath(id);
    if (!fs.existsSync(audioPath)) return null;
    const buffer = await fs.promises.readFile(audioPath);
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  /**
   * Checks whether the given path exists on disk.
   */
  fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }
}
