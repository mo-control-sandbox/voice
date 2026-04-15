import type { StatsService } from '../gen/ipc_service';
import type { DashboardStatsResponse } from '../gen/stats';
import type { Empty } from '../gen/google/protobuf/empty';
import type { HistoryStore } from '../services/HistoryStore';
import type { StatsCalculator } from '../services/StatsCalculator';

/**
 * IPC service that computes and returns dashboard statistics
 * derived from the full session history.
 */
export class StatsIpcService implements StatsService {
  constructor(
    private readonly historyStore: HistoryStore,
    private readonly statsCalculator: StatsCalculator,
  ) {}

  GetStats(_request: Empty): Promise<DashboardStatsResponse> {
    const stats = this.statsCalculator.compute(this.historyStore.getSessions());
    return Promise.resolve({
      totalSessions: stats.totalSessions,
      totalWords: stats.totalWords,
      totalTimeSavedSeconds: stats.totalTimeSavedSeconds,
      wordsPerMinute: stats.wordsPerMinute,
      keystrokesSaved: stats.keystrokesSaved,
    });
  }
}
