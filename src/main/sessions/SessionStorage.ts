import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from '@mobrowser/api';
import { encodeWav } from './wav';

/**
 * Tracks an in-progress streaming audio write for one session.
 */
interface AudioStream {
  handle: fs.promises.FileHandle;
  bytesWritten: number;
}

const WAV_RIFF_SIZE_OFFSET = 4;
const WAV_DATA_SIZE_OFFSET = 40;

/**
 * File-based storage for recording session data.
 */
export class SessionStorage {
  private readonly audioStreams = new Map<string, AudioStream>();

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
   * Appends a raw PCM chunk to the session's audio file.
   *
   * Opens the file on the first call for a given session: creates the session
   * directory and writes a placeholder WAV header (sizes set to zero). Subsequent
   * calls append PCM bytes directly. Call finalizeAudioStream() once all chunks
   * have been written to patch the WAV header with the correct sizes.
   */
  async appendAudioChunk(id: string, pcm: Uint8Array): Promise<void> {
    let stream = this.audioStreams.get(id);

    if (!stream) {
      const dir = this.getSessionDir(id);
      await fs.promises.mkdir(dir, { recursive: true });
      const handle = await fs.promises.open(this.getAudioPath(id), 'w');
      // Placeholder header with pcmByteLength=0; sizes are patched in finalizeAudioStream.
      const placeholder = encodeWav(new Uint8Array(0));
      await handle.write(placeholder);
      stream = { handle, bytesWritten: 0 };
      this.audioStreams.set(id, stream);
    }

    await stream.handle.write(pcm);
    stream.bytesWritten += pcm.byteLength;
  }

  /**
   * Closes the audio stream for the given session and patches the WAV header
   * with the correct RIFF and data chunk sizes.
   *
   * No-op when no stream is open (e.g. dontSaveAudio was set).
   */
  async finalizeAudioStream(id: string): Promise<void> {
    const stream = this.audioStreams.get(id);
    this.audioStreams.delete(id);
    if (!stream) return;

    const pcmByteLength = stream.bytesWritten;

    const riffSizeBuf = Buffer.alloc(4);
    riffSizeBuf.writeUInt32LE(36 + pcmByteLength, 0);
    await stream.handle.write(riffSizeBuf, 0, 4, WAV_RIFF_SIZE_OFFSET);

    const dataSizeBuf = Buffer.alloc(4);
    dataSizeBuf.writeUInt32LE(pcmByteLength, 0);
    await stream.handle.write(dataSizeBuf, 0, 4, WAV_DATA_SIZE_OFFSET);

    await stream.handle.close();
  }

  /**
   * Closes and discards the open audio stream for the given session without
   * finalizing the WAV header. The partial file is left on disk and will be
   * removed by deleteSessionFiles() if called.
   *
   * No-op when no stream is open.
   */
  async discardAudioStream(id: string): Promise<void> {
    const stream = this.audioStreams.get(id);
    this.audioStreams.delete(id);
    if (!stream) return;
    await stream.handle.close();
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
