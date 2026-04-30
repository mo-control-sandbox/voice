/**
 * Formats a Unix timestamp in milliseconds as a compact date-time label.
 */
export function formatShortDateTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats a Unix timestamp in milliseconds as a detailed date-time label.
 */
export function formatLongDateTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

/**
 * Formats a duration in seconds as m:ss.
 */
export function formatMinutesAndSeconds(seconds: number): string {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const remainingSeconds = total % 60;
  return `${String(minutes)}:${String(remainingSeconds).padStart(2, '0')}`;
}

/**
 * Formats a player clock value in seconds as m:ss, with a fallback for invalid values.
 */
export function formatPlayerClock(seconds: number): string {
  if (!Number.isFinite(seconds)) return '--:--';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const remainingSeconds = total % 60;
  return `${String(minutes)}:${String(remainingSeconds).padStart(2, '0')}`;
}

/**
 * Formats a duration in seconds as sec, min, or hr for compact statistics display.
 */
export function formatCompactDuration(seconds: number): string {
  if (seconds < 60) return `${String(Math.round(seconds))} sec`;
  if (seconds < 3600) return `${String(Math.round(seconds / 60))} min`;
  return `${(seconds / 3600).toFixed(1)} hr`;
}
