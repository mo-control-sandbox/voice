import { randomUUID } from 'node:crypto';
import { AudioBuffer } from '../sessions/AudioBuffer';

/**
 * A recording session.
 */
export class RecordingSession {
  /**
   * Unique identifier for this session.
   */
  readonly id = randomUUID();

  /**
   * Unix timestamp when the session was created.
   */
  readonly startedAt = Date.now();

  /**
   * Buffered audio captured for this session when audio persistence is enabled.
   */
  readonly audioBuffer: AudioBuffer | null;

  constructor(
    /**
     * Whether audio should be written to disk for this session.
     */
    readonly saveAudio: boolean,
    /**
     * Whether the transcript should be written to disk for this session.
     */
    readonly saveTranscripts: boolean,
  ) {
    this.audioBuffer = saveAudio ? new AudioBuffer() : null;
  }
}
