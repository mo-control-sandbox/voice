import type { JSX, KeyboardEvent } from 'react';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const PREDEFINED_SHORTCUTS: readonly string[] = [
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6',
  'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
];

interface ShortcutConfiguratorProps {
  readonly currentShortcut: string
  readonly onChange: (shortcut: string) => void
}

/**
 * Converts a KeyboardEvent into a human-readable shortcut string
 * (e.g. "F5", "Meta+Shift+K").
 */
function keyEventToShortcut(e: KeyboardEvent<HTMLInputElement>): string {
  const parts: string[] = [];
  if (e.metaKey)  parts.push('Meta');
  if (e.ctrlKey)  parts.push('Ctrl');
  if (e.altKey)   parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');

  const key = e.key;
  const isModifierOnly = ['Meta', 'Control', 'Alt', 'Shift'].includes(key);
  if (!isModifierOnly) parts.push(key);

  return parts.join('+');
}

/**
 * Allows the user to select a global shortcut from predefined options or
 * capture a custom key combination.
 */
export function ShortcutConfigurator({ currentShortcut, onChange }: ShortcutConfiguratorProps): JSX.Element {
  const [capturing, setCapturing] = useState(false);
  const [displayValue, setDisplayValue] = useState(currentShortcut);
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePredefined = (shortcut: string): void => {
    setDisplayValue(shortcut);
    onChange(shortcut);
  };

  const handleCaptureKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    e.preventDefault();
    const shortcut = keyEventToShortcut(e);
    if (shortcut === '') return;
    setDisplayValue(shortcut);
    setCapturing(false);
    onChange(shortcut);
    inputRef.current?.blur();
  };

  const handleCaptureBlur = (): void => {
    setCapturing(false);
    setDisplayValue(currentShortcut);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PREDEFINED_SHORTCUTS.map((shortcut) => (
          <button
            key={shortcut}
            type="button"
            onClick={() => { handlePredefined(shortcut); }}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-mono font-medium border transition-colors',
              currentShortcut === shortcut
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-muted text-foreground border-border hover:bg-accent',
            )}
          >
            {shortcut}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">Custom:</span>
        <input
          ref={inputRef}
          readOnly
          value={capturing ? 'Press any key…' : displayValue}
          onFocus={() => { setCapturing(true); }}
          onBlur={handleCaptureBlur}
          onKeyDown={handleCaptureKeyDown}
          className={cn(
            'w-36 px-3 py-1.5 text-xs font-mono rounded-md border bg-background text-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
            capturing ? 'border-primary text-muted-foreground' : 'border-input cursor-pointer',
          )}
        />
      </div>
    </div>
  );
}
