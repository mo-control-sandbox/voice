import { ipc } from '@mobrowser/api';
import { StatsService as createStatsService, type StatsService as StatsServiceInterface } from '../gen/ipc_service';
import type { DashboardStats, GetStatsRequest } from '../gen/settings';
import type { TranscriptionSession } from '../sessions/History';

/*
 * Assumed average typing speed for the time-saved calculation.
 * 40 WPM is a widely cited figure for typical non-touch-typists.
 */
const BASELINE_TYPING_WPM = 40;

/*
 * Upper bound applied to the words-per-minute stat.
 * Clamps single-word sessions and other statistical outliers to a
 * plausible display value.
 */
const MAX_WPM = 999;

/**
 * Computes dashboard statistics from a snapshot of the session history.
 */
export function calculate(sessions: TranscriptionSession[]): DashboardStats {
  const totalSessions = sessions.length;
  const totalWords = sessions.reduce((sum, s) => sum + s.wordCount, 0);
  const totalAudioSeconds = sessions.reduce((sum, s) => sum + s.audioDurationSeconds, 0);

  const totalTimeSavedSeconds = (totalWords / BASELINE_TYPING_WPM) * 60;
  const wordsPerMinute = totalAudioSeconds > 0
    ? Math.min(totalWords / (totalAudioSeconds / 60), MAX_WPM)
    : 0;
  const keystrokesSaved = sessions.reduce(
    (sum, s) => sum + (s.transcriptionText !== null ? s.transcriptionText.length : 0),
    0,
  );

  return {
    totalTimeSavedSeconds,
    totalSessions,
    totalWords,
    wordsPerMinute,
    keystrokesSaved,
  };
}

/**
 * Registers the Stats IPC service so the renderer can request dashboard metrics.
 */
export function registerStatsIpc(historyStore: { getSessions(): TranscriptionSession[] }): void {
  ipc.registerService(createStatsService(new StatsService(historyStore)));
}

class StatsService implements StatsServiceInterface {
  constructor(private readonly historyStore: { getSessions(): TranscriptionSession[] }) {}

  GetStats(_request: GetStatsRequest) {
    const stats = calculate(this.historyStore.getSessions());
    return Promise.resolve({
      totalTimeSavedSeconds: stats.totalTimeSavedSeconds,
      totalSessions: stats.totalSessions,
      totalWords: stats.totalWords,
      wordsPerMinute: stats.wordsPerMinute,
      keystrokesSaved: stats.keystrokesSaved,
    });
  }
}
