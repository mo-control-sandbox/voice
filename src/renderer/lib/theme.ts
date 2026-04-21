/**
 * Initialises the dark/light theme on startup.
 *
 * Applies a `.dark` class to `document.documentElement` based on:
 *   1. A stored `theme` preference in localStorage  (`'dark'` | `'light'`)
 *   2. The OS `prefers-color-scheme` value when no preference is stored
 *
 * Call once per renderer process, before the React tree mounts, so there is
 * no flash of the wrong theme.
 */
export function initTheme(): void {
  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = stored === 'dark' || (stored === null && prefersDark);
  document.documentElement.classList.toggle('dark', isDark);
}
