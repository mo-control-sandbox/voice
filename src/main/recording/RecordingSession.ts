import { randomUUID } from 'node:crypto';

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

  constructor(
    /**
     * Whether audio should be written to disk for this session.
     */
    readonly saveAudio: boolean,
    /**
     * Whether the transcript should be written to disk for this session.
     */
    readonly saveTranscripts: boolean,
  ) {}
}
