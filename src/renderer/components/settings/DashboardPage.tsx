import type { JSX } from 'react';
import { Clock, Mic, BookOpen, Zap, Keyboard } from 'lucide-react';
import type { DashboardStatsResponse } from '@/gen/stats';

/** Formats seconds into an appropriate human-readable duration string. */
function formatTimeSaved(seconds: number): string {
  if (seconds < 60) return `${String(Math.round(seconds))} sec`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`;
  return `${(seconds / 3600).toFixed(1)} hr`;
}

interface StatBannerProps {
  readonly icon: JSX.Element
  readonly label: string
  readonly value: string
  readonly colorClass: string
}

function StatBanner({ icon, label, value, colorClass }: StatBannerProps): JSX.Element {
  return (
    <div className={`rounded-xl p-5 flex flex-col gap-3 ${colorClass}`}>
      <div className="opacity-80">{icon}</div>
      <div>
        <p className="text-3xl font-bold leading-none">{value}</p>
        <p className="text-sm font-medium mt-1 opacity-80">{label}</p>
      </div>
    </div>
  );
}

interface DashboardPageProps {
  readonly stats: DashboardStatsResponse
}

/**
 * Dashboard page showing aggregate productivity statistics as large
 * colourful stat banners.
 */
export function DashboardPage({ stats }: DashboardPageProps): JSX.Element {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Your moVoice productivity at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatBanner
          icon={<Clock className="w-6 h-6" />}
          label="Time saved"
          value={formatTimeSaved(stats.totalTimeSavedSeconds)}
          colorClass="bg-violet-500 text-white dark:bg-violet-600"
        />
        <StatBanner
          icon={<Mic className="w-6 h-6" />}
          label="Sessions recorded"
          value={stats.totalSessions.toLocaleString()}
          colorClass="bg-blue-500 text-white dark:bg-blue-600"
        />
        <StatBanner
          icon={<BookOpen className="w-6 h-6" />}
          label="Words dictated"
          value={stats.totalWords.toLocaleString()}
          colorClass="bg-emerald-500 text-white dark:bg-emerald-600"
        />
        <StatBanner
          icon={<Zap className="w-6 h-6" />}
          label="Words per minute"
          value={stats.wordsPerMinute > 0 ? stats.wordsPerMinute.toFixed(1) : '—'}
          colorClass="bg-amber-500 text-white dark:bg-amber-600"
        />
        <StatBanner
          icon={<Keyboard className="w-6 h-6" />}
          label="Keystrokes saved"
          value={stats.keystrokesSaved.toLocaleString()}
          colorClass="bg-rose-500 text-white dark:bg-rose-600 col-span-2"
        />
      </div>
    </div>
  );
}
