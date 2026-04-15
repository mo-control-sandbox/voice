import type { CapturedApp } from '../../shared/types';

/**
 * Immutable snapshot of the parameters captured at the moment recording begins.
 * Passed through the processing pipeline so that preference changes mid-flight
 * (e.g. toggling dontSaveAudio) do not affect the in-progress session.
 */
export interface RecordingSession {
  readonly id: string;
  readonly startedAt: number;
  readonly capturedApp: CapturedApp;
  /** BCP-47 language code, or `null` when auto-detect was selected. */
  readonly language: string | null;
  readonly dontSaveAudio: boolean;
  readonly dontSaveTranscripts: boolean;
}

/**
 * Construct a new `RecordingSession`, assigning a UUID v4 and capturing the
 * current wall-clock time as `startedAt`.
 */
export function createRecordingSession(
  params: Omit<RecordingSession, 'id' | 'startedAt'>,
): RecordingSession {
  return {
    id: crypto.randomUUID(),
    startedAt: Date.now(),
    ...params,
  };
}
