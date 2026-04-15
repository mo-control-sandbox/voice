import type { SessionRecord, DashboardStats } from '../../shared/types';

/** Average human typing speed used to estimate time saved. */
export const BASELINE_TYPING_WPM = 40;

/** Average word length including trailing space, used to count keystrokes saved. */
export const AVG_WORD_LENGTH_WITH_SPACE = 6;

/**
 * Derives productivity statistics from the full session history.
 * Stateless — all results are computed fresh on each call.
 */
export class StatsCalculator {
  /** Compute aggregate dashboard statistics from all recorded sessions. */
  compute(sessions: SessionRecord[]): DashboardStats {
    let totalWords = 0;
    let totalAudioDurationSeconds = 0;

    for (const session of sessions) {
      const words = session.transcriptionText
        .split(/\s+/)
        .filter(Boolean).length;
      totalWords += words;
      totalAudioDurationSeconds += session.audioDurationSeconds;
    }

    const totalTimeSavedSeconds = (totalWords / BASELINE_TYPING_WPM) * 60;
    const keystrokesSaved = totalWords * AVG_WORD_LENGTH_WITH_SPACE;
    const wordsPerMinute =
      totalAudioDurationSeconds > 0
        ? totalWords / (totalAudioDurationSeconds / 60)
        : 0;

    return {
      totalSessions: sessions.length,
      totalWords,
      totalTimeSavedSeconds,
      wordsPerMinute,
      keystrokesSaved,
    };
  }
}
