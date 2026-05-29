const SHORTCUT_TOKEN_LABELS: Readonly<Record<string, string>> = {
  Alt: '⌥',
  Cmd: '⌘',
  CmdOrCtrl: '⌘',
  Command: '⌘',
  CommandOrControl: '⌘',
  Control: '⌃',
  Ctrl: '⌃',
  Meta: '⌘',
  Option: '⌥',
  Shift: '⇧',
  Space: 'Space',
  Super: '⌘',
};

/**
 * Returns a readable label for a MoBrowser shortcut accelerator.
 */
export function formatShortcutLabel(shortcut: string | null | undefined): string {
  if (shortcut === null || shortcut === undefined) return '';

  return shortcut
    .split('+')
    .map((token) => token.trim())
    .filter((token) => token !== '')
    .map((token) => SHORTCUT_TOKEN_LABELS[token] ?? token)
    .join(' + ');
}
