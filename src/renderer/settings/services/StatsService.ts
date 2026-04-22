import { ipc } from '../../gen/ipc';
import type { DashboardStats } from '../../gen/stats';

/**
 * IPC adapter for the statistics domain.
 *
 * Provides access to aggregated usage stats for the dashboard page without
 * exposing the IPC module to UI components.
 */
export class StatsService {
  /** Returns aggregated usage statistics for the current user. */
  async getStats(): Promise<DashboardStats> {
    return ipc.stats.GetStats({});
  }
}
