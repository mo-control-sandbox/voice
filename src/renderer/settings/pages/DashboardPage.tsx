import { useEffect, useState } from 'react';
import type { DashboardStats } from '../../gen/stats';
import { StatsService } from '../services/StatsService';

const statsService = new StatsService();

/** Formats a duration in seconds as a human-readable string (sec / min / hr). */
function formatTimeSaved(seconds: number): string {
  if (seconds < 60) return `${String(Math.round(seconds))} sec`;
  if (seconds < 3600) return `${String(Math.round(seconds / 60))} min`;
  return `${(seconds / 3600).toFixed(1)} hr`;
}

/** Formats a large integer with locale-aware thousands separators. */
function formatCount(n: number): string {
  return Math.round(n).toLocaleString();
}

/** Dashboard page showing aggregated usage statistics. */
export function DashboardPage(): React.JSX.Element {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    void statsService.getStats().then(setStats);
  }, []);

  if (stats === null) return <p>Loading...</p>;

  return (
    <div>
      <p>Time Saved: {formatTimeSaved(stats.totalTimeSavedSeconds)}</p>
      <p>Sessions: {formatCount(stats.totalSessions)}</p>
      <p>Words: {formatCount(stats.totalWords)}</p>
      <p>Words/min: {stats.wordsPerMinute > 0 ? String(Math.round(stats.wordsPerMinute)) : '—'}</p>
      <p>Keystrokes saved: {formatCount(stats.keystrokesSaved)}</p>
    </div>
  );
}
