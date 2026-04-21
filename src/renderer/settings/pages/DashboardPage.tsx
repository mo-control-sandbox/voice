import { useEffect, useState } from 'react';
import type { DashboardStats } from '../../gen/stats';
import { StatsService } from '../services/StatsService';
import './DashboardPage.css';

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

interface StatBannerProps {
  readonly label: string;
  readonly value: string;
}

/** A metric tile — large value above a muted label. */
function StatBanner({ label, value }: StatBannerProps): React.JSX.Element {
  return (
    <div className="stat-banner">
      <span className="stat-banner__value">{value}</span>
      <span className="stat-banner__label">{label}</span>
    </div>
  );
}

/** Dashboard page showing aggregated usage statistics. */
export function DashboardPage(): React.JSX.Element {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    void statsService.getStats().then(setStats);
  }, []);

  if (stats === null) {
    return (
      <div className="dashboard-page">
        <h2 className="dashboard-page__heading">Dashboard</h2>
        <div className="dashboard-page__loading" aria-busy="true" aria-label="Loading statistics">
          <div className="dashboard-page__skeleton" />
          <div className="dashboard-page__skeleton" />
          <div className="dashboard-page__skeleton" />
          <div className="dashboard-page__skeleton" />
          <div className="dashboard-page__skeleton" />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <h2 className="dashboard-page__heading">Dashboard</h2>

      {/* dl/dt/dd semantics make label-value pairs unambiguous to screen readers */}
      <dl className="dashboard-page__grid">
        <StatBanner
          label="Time Saved"
          value={formatTimeSaved(stats.totalTimeSavedSeconds)}
        />
        <StatBanner
          label="Sessions Recorded"
          value={formatCount(stats.totalSessions)}
        />
        <StatBanner
          label="Words Dictated"
          value={formatCount(stats.totalWords)}
        />
        <StatBanner
          label="Words / Minute"
          value={stats.wordsPerMinute > 0 ? String(Math.round(stats.wordsPerMinute)) : '—'}
        />
        <StatBanner
          label="Keystrokes Saved"
          value={formatCount(stats.keystrokesSaved)}
        />
      </dl>
    </div>
  );
}
