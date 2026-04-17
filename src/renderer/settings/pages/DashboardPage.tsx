import { useEffect, useState } from 'react';
import { ipc } from '../../gen/ipc';
import type { DashboardStats } from '../../gen/stats';

/** Formats a duration in seconds as a human-readable string (s / min / hr). */
function formatTimeSaved(seconds: number): string {
  if (seconds < 60) return `${String(Math.round(seconds))} sec`;
  if (seconds < 3600) return `${String(Math.round(seconds / 60))} min`;
  return `${(seconds / 3600).toFixed(1)} hr`;
}

/** Formats a large integer with thousands separators. */
function formatCount(n: number): string {
  return Math.round(n).toLocaleString();
}

interface StatBannerProps {
  readonly label: string;
  readonly value: string;
  readonly accent: string;
}

/** A single large coloured stat card. */
function StatBanner({ label, value, accent }: StatBannerProps): React.JSX.Element {
  return (
    <div className={`rounded-xl p-6 flex flex-col gap-2 ${accent}`}>
      <span className="text-sm font-medium opacity-80">{label}</span>
      <span className="text-3xl font-bold tracking-tight">{value}</span>
    </div>
  );
}

/** Dashboard page showing aggregated usage statistics. */
export function DashboardPage(): React.JSX.Element {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    void ipc.stats.GetStats({}).then(setStats);
  }, []);

  if (stats === null) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4">
        <StatBanner
          label="Time Saved"
          value={formatTimeSaved(stats.totalTimeSavedSeconds)}
          accent="bg-violet-500/15 text-violet-700 dark:text-violet-300"
        />
        <StatBanner
          label="Sessions Recorded"
          value={formatCount(stats.totalSessions)}
          accent="bg-blue-500/15 text-blue-700 dark:text-blue-300"
        />
        <StatBanner
          label="Words Dictated"
          value={formatCount(stats.totalWords)}
          accent="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
        />
        <StatBanner
          label="Words / Minute"
          value={stats.wordsPerMinute > 0 ? String(Math.round(stats.wordsPerMinute)) : '—'}
          accent="bg-amber-500/15 text-amber-700 dark:text-amber-300"
        />
        <StatBanner
          label="Keystrokes Saved"
          value={formatCount(stats.keystrokesSaved)}
          accent="bg-rose-500/15 text-rose-700 dark:text-rose-300 col-span-2"
        />
      </div>
    </div>
  );
}
