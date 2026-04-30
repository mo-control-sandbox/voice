import { useEffect, useState } from 'react';
import { Mic, AlignLeft, Gauge, Keyboard, Clock } from 'lucide-react';
import type { DashboardStats } from '../../gen/settings';
import { StatsService } from '../services/StatsService';
import './DashboardPage.css';

const statsService = new StatsService();

/** Formats a duration in seconds as a human-readable string. */
function formatTimeSaved(seconds: number): string {
  if (seconds < 60)   return `${String(Math.round(seconds))} sec`;
  if (seconds < 3600) return `${String(Math.round(seconds / 60))} min`;
  return `${(seconds / 3600).toFixed(1)} hr`;
}

/** Formats a large integer with locale-aware thousands separators. */
function formatCount(n: number): string {
  return Math.round(n).toLocaleString();
}

/** Formats WPM to one decimal place. */
function formatWpm(n: number): string {
  return n.toFixed(1);
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
        <h1 className="dashboard-page__heading">Dashboard</h1>
        <div className="dashboard-page__loading">
          <div className="dashboard-page__skeleton" />
          <div className="dashboard-page__skeleton" />
          <div className="dashboard-page__skeleton" />
          <div className="dashboard-page__skeleton" />
          <div className="dashboard-page__skeleton" />
        </div>
      </div>
    );
  }

  const wpmValue = stats.wordsPerMinute > 0 ? formatWpm(stats.wordsPerMinute) : '—';

  return (
    <div className="dashboard-page">
      <h1 className="dashboard-page__heading">Dashboard</h1>
      <div className="dashboard-page__grid">

        <div className="stat-card" data-accent="sessions">
          <div className="stat-card__header">
            <div className="stat-card__icon-wrap" aria-hidden="true">
              <Mic size={20} />
            </div>
            <span className="stat-card__title">Sessions Recorded</span>
          </div>
          <span className="stat-card__value">{formatCount(stats.totalSessions)}</span>
          <span className="stat-card__desc">MoVoice sessions completed</span>
        </div>

        <div className="stat-card" data-accent="words">
          <div className="stat-card__header">
            <div className="stat-card__icon-wrap" aria-hidden="true">
              <AlignLeft size={20} />
            </div>
            <span className="stat-card__title">Words Dictated</span>
          </div>
          <span className="stat-card__value">{formatCount(stats.totalWords)}</span>
          <span className="stat-card__desc">words generated</span>
        </div>

        <div className="stat-card" data-accent="wpm">
          <div className="stat-card__header">
            <div className="stat-card__icon-wrap" aria-hidden="true">
              <Gauge size={20} />
            </div>
            <span className="stat-card__title">Words Per Minute</span>
          </div>
          <span className="stat-card__value">{wpmValue}</span>
          <span className="stat-card__desc">MoVoice vs. typing by hand</span>
        </div>

        <div className="stat-card" data-accent="keystrokes">
          <div className="stat-card__header">
            <div className="stat-card__icon-wrap" aria-hidden="true">
              <Keyboard size={20} />
            </div>
            <span className="stat-card__title">Keystrokes Saved</span>
          </div>
          <span className="stat-card__value">{formatCount(stats.keystrokesSaved)}</span>
          <span className="stat-card__desc">fewer keystrokes</span>
        </div>

        {/* Hero card spanning both columns */}
        <div className="stat-card stat-card--wide" data-accent="time">
          <div className="stat-card__header">
            <div className="stat-card__icon-wrap" aria-hidden="true">
              <Clock size={20} />
            </div>
            <span className="stat-card__title">Time Saved</span>
          </div>
          <span className="stat-card__value">{formatTimeSaved(stats.totalTimeSavedSeconds)}</span>
          <span className="stat-card__desc">vs. typing at 40 wpm</span>
        </div>

      </div>
    </div>
  );
}
