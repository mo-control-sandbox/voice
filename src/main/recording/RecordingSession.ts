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
   * Unix timestamp (ms) when the session was created.
   */
  readonly startedAt = Date.now();

  constructor(
    /**
     * Whether audio should NOT be written to disk for this session.
     */
    readonly dontSaveAudio: boolean,
    /**
     * Whether the transcript should NOT be written to disk for this session.
     */
    readonly dontSaveTranscripts: boolean,
    /**
     * Maximum recording wall-clock duration in milliseconds.
     */
    readonly maxDurationMs: number,
  ) {}
}
