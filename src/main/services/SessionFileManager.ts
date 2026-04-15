import * as fs from 'node:fs';
import * as path from 'node:path';

/** WAV format tag for 32-bit IEEE float PCM. */
const WAV_FORMAT_IEEE_FLOAT = 3;
const WAV_SAMPLE_RATE = 16_000;
const WAV_CHANNELS = 1;
const WAV_BITS_PER_SAMPLE = 32;
const WAV_HEADER_BYTES = 44;

/**
 * Owns all file paths and file I/O for individual session recordings and transcripts.
 * Each session lives in its own subdirectory: `<userData>/sessions/<sessionId>/`.
 */
export class SessionFileManager {
  private readonly sessionsRoot: string;

  constructor(userDataPath: string) {
    this.sessionsRoot = path.join(userDataPath, 'sessions');
  }

  /** Absolute path to the directory holding all files for one session. */
  getSessionDir(sessionId: string): string {
    return path.join(this.sessionsRoot, sessionId);
  }

  /** Absolute path to the WAV audio file for one session. */
  getAudioPath(sessionId: string): string {
    return path.join(this.getSessionDir(sessionId), 'audio.wav');
  }

  /** Absolute path to the plain-text transcript file for one session. */
  getTranscriptPath(sessionId: string): string {
    return path.join(this.getSessionDir(sessionId), 'transcript.txt');
  }

  /**
   * Write a WAV file containing the given 16 kHz mono 32-bit float PCM samples.
   * Encodes a standard 44-byte RIFF/WAVE header followed by the raw sample data.
   */
  async saveAudio(sessionId: string, pcm: Float32Array): Promise<void> {
    const audioPath = this.getAudioPath(sessionId);
    await fs.promises.mkdir(this.getSessionDir(sessionId), { recursive: true });

    const dataBytes = pcm.length * 4; // 4 bytes per float32 sample
    const fileSize = WAV_HEADER_BYTES - 8 + dataBytes;
    const byteRate = WAV_SAMPLE_RATE * WAV_CHANNELS * (WAV_BITS_PER_SAMPLE / 8);
    const blockAlign = WAV_CHANNELS * (WAV_BITS_PER_SAMPLE / 8);

    const header = Buffer.alloc(WAV_HEADER_BYTES);
    let offset = 0;

    // RIFF chunk descriptor
    header.write('RIFF', offset); offset += 4;
    header.writeUInt32LE(fileSize, offset); offset += 4;
    header.write('WAVE', offset); offset += 4;

    // fmt sub-chunk
    header.write('fmt ', offset); offset += 4;
    header.writeUInt32LE(16, offset); offset += 4;                        // chunk size
    header.writeUInt16LE(WAV_FORMAT_IEEE_FLOAT, offset); offset += 2;    // audio format
    header.writeUInt16LE(WAV_CHANNELS, offset); offset += 2;
    header.writeUInt32LE(WAV_SAMPLE_RATE, offset); offset += 4;
    header.writeUInt32LE(byteRate, offset); offset += 4;
    header.writeUInt16LE(blockAlign, offset); offset += 2;
    header.writeUInt16LE(WAV_BITS_PER_SAMPLE, offset); offset += 2;

    // data sub-chunk
    header.write('data', offset); offset += 4;
    header.writeUInt32LE(dataBytes, offset);

    const pcmBuffer = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    await fs.promises.writeFile(audioPath, Buffer.concat([header, pcmBuffer]));
  }

  /** Write the transcription text as a plain UTF-8 text file. */
  async saveTranscript(sessionId: string, text: string): Promise<void> {
    const transcriptPath = this.getTranscriptPath(sessionId);
    await fs.promises.mkdir(this.getSessionDir(sessionId), { recursive: true });
    await fs.promises.writeFile(transcriptPath, text, 'utf8');
  }

  /** Delete the entire session directory and all files within it. */
  async deleteSessionFiles(sessionId: string): Promise<void> {
    const sessionDir = this.getSessionDir(sessionId);
    await fs.promises.rm(sessionDir, { recursive: true, force: true });
  }

  /** Return `true` if the file at `filePath` exists on disk. */
  fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * Return the `file://` URL for the audio file of a session.
   * Returns an empty string when the audio file does not exist on disk.
   */
  getAudioFileUrl(sessionId: string): string {
    const audioPath = this.getAudioPath(sessionId);
    if (!this.fileExists(audioPath)) {
      return '';
    }
    return `file://${audioPath}`;
  }
}
