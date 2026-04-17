import { useEffect, useRef, useState } from 'react';
import { ipc } from '../../gen/ipc';

// ── Audio device picker ────────────────────────────────────────────────────

interface AudioDevice {
  readonly deviceId: string;
  readonly label: string;
}

// ── Shortcut picker ────────────────────────────────────────────────────────

/**
 * Predefined shortcuts the user can choose from with a single click.
 * Keys use MōBrowser accelerator format (CommandOrControl, Command, Control,
 * Shift, Alt). "Meta" is intentionally excluded — it is not a valid modifier.
 */
const PREDEFINED_SHORTCUTS: readonly { readonly label: string; readonly value: string }[] = [
  { label: '⌘⇧Space',  value: 'CommandOrControl+Shift+Space' },
  { label: '⌘⇧M',      value: 'CommandOrControl+Shift+M' },
  { label: '⌘⇧R',      value: 'CommandOrControl+Shift+R' },
  { label: '⌃Space',   value: 'Control+Space' },
  { label: '⌥Space',   value: 'Alt+Space' },
];

/**
 * Converts a KeyboardEvent into a MōBrowser accelerator string.
 *
 * Rules:
 * - At least one modifier required (Command, Control, Shift, Alt).
 * - "Meta" is never emitted — on macOS, metaKey maps to "Command".
 * - Modifier-only keypresses return null (wait for the actual key).
 * - Letters are uppercased; Space is spelled out.
 */
function buildAccelerator(e: KeyboardEvent): string | null {
  const MODIFIER_KEYS = new Set(['Meta', 'Control', 'Shift', 'Alt', 'Command']);
  if (MODIFIER_KEYS.has(e.key)) return null;

  const parts: string[] = [];
  // On macOS, metaKey is the ⌘ Command key. Map to "Command", never "Meta".
  if (e.metaKey) parts.push('Command');
  if (e.ctrlKey) parts.push('Control');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');

  if (parts.length === 0) return null; // no modifier → ignore

  let key = e.key;
  if (key === ' ') {
    key = 'Space';
  } else if (key.length === 1) {
    key = key.toUpperCase();
  }

  parts.push(key);
  return parts.join('+');
}

/** Formats an accelerator string for human-readable display. */
function formatShortcut(accelerator: string): string {
  return accelerator
    .replace('CommandOrControl', '⌘')
    .replace('Command', '⌘')
    .replace('Control', '⌃')
    .replace('Shift', '⇧')
    .replace('Alt', '⌥')
    .replace(/\+/g, '');
}

// ── Page ───────────────────────────────────────────────────────────────────

/**
 * General settings page.
 *
 * Exposes audio input device selection and global shortcut configuration.
 */
export function GeneralPage(): React.JSX.Element {
  // Audio device state
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  // Shortcut state
  const [shortcutKey, setShortcutKey] = useState<string>('');
  const [isCapturing, setIsCapturing] = useState(false);
  const captureRef = useRef<HTMLButtonElement>(null);

  // Boolean preferences
  const [dontSaveTranscripts, setDontSaveTranscripts] = useState(false);
  const [dontSaveAudio, setDontSaveAudio] = useState(false);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load(): Promise<void> {
      // Device labels are only populated after mic permission is granted.
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        tempStream.getTracks().forEach((t) => { t.stop(); });
      } catch {
        // Permission denied — labels will be empty but the UI still works.
      }

      const [settings, allDevices] = await Promise.all([
        ipc.settings.GetSettings({}),
        navigator.mediaDevices.enumerateDevices(),
      ]);

      const audioInputs = allDevices
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label || d.deviceId }));

      setDevices(audioInputs);
      setSelectedDeviceId(settings.audioInputDeviceId);
      setShortcutKey(settings.shortcutKey);
      setDontSaveTranscripts(settings.dontSaveTranscripts);
      setDontSaveAudio(settings.dontSaveAudio);
      setIsLoading(false);
    }
    void load();
  }, []);

  // Capture mode: suspend the global shortcut so pressing the existing shortcut
  // doesn't start recording, then listen for the replacement key.
  useEffect(() => {
    if (!isCapturing) return;

    void ipc.settings.SetShortcutCaptureMode({ capturing: true });

    function onKeyDown(e: KeyboardEvent): void {
      e.preventDefault();
      if (e.key === 'Escape') {
        setIsCapturing(false);
        return;
      }
      const accelerator = buildAccelerator(e);
      if (accelerator === null) return;
      setIsCapturing(false);
      void saveShortcut(accelerator);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      void ipc.settings.SetShortcutCaptureMode({ capturing: false });
    };
  }, [isCapturing]);

  async function handleDontSaveTranscripts(value: boolean): Promise<void> {
    setDontSaveTranscripts(value);
    await ipc.settings.SetDontSaveTranscripts({ value });
  }

  async function handleDontSaveAudio(value: boolean): Promise<void> {
    setDontSaveAudio(value);
    await ipc.settings.SetDontSaveAudio({ value });
  }

  async function handleDeviceChange(deviceId: string): Promise<void> {
    setSelectedDeviceId(deviceId);
    await ipc.settings.SetAudioInputDevice({ deviceId });
  }

  async function saveShortcut(accelerator: string): Promise<void> {
    setShortcutKey(accelerator);
    await ipc.settings.SetShortcutKey({ shortcutKey: accelerator });
  }

  async function handlePredefinedShortcut(value: string): Promise<void> {
    await saveShortcut(value);
  }

  function startCapture(): void {
    setIsCapturing(true);
    captureRef.current?.focus();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">General</h1>

      {/* ── Audio Input ── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Audio Input
        </h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading devices…</p>
        ) : (
          <select
            value={selectedDeviceId}
            onChange={(e) => { void handleDeviceChange(e.target.value); }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">System default</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          The microphone used for recording. Selecting a specific device overrides the system default.
        </p>
      </section>

      {/* ── Preferences ── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Preferences
        </h2>
        <div className="flex flex-col gap-3">
          {(
            [
              { label: "Don't Save Transcripts", value: dontSaveTranscripts, onChange: handleDontSaveTranscripts },
              { label: "Don't Save Audio",       value: dontSaveAudio,       onChange: handleDontSaveAudio       },
            ]
          ).map(({ label, value, onChange }) => (
            <label key={label} className="flex items-center justify-between gap-4 cursor-pointer select-none">
              <span className="text-sm">{label}</span>
              <button
                role="switch"
                aria-checked={value}
                onClick={() => { void onChange(!value); }}
                className={[
                  'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                  value ? 'bg-primary' : 'bg-input',
                ].join(' ')}
              >
                <span
                  className={[
                    'pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-lg transform ring-0 transition-transform',
                    value ? 'translate-x-4' : 'translate-x-0',
                  ].join(' ')}
                />
              </button>
            </label>
          ))}
        </div>
      </section>

      {/* ── Global Shortcut ── */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Global Shortcut
        </h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            {/* Predefined list */}
            <div className="flex flex-wrap gap-2 mb-4">
              {PREDEFINED_SHORTCUTS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => { void handlePredefinedShortcut(s.value); }}
                  className={[
                    'rounded-md border px-3 py-1.5 text-sm font-mono transition-colors',
                    shortcutKey === s.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-input bg-background hover:bg-muted',
                  ].join(' ')}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Custom capture */}
            <div className="flex items-center gap-3">
              <button
                ref={captureRef}
                onClick={startCapture}
                className={[
                  'rounded-md border px-3 py-1.5 text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring',
                  isCapturing
                    ? 'border-primary bg-primary/10 text-primary animate-pulse'
                    : 'border-input bg-background hover:bg-muted',
                ].join(' ')}
              >
                {isCapturing ? 'Press a shortcut…' : 'Custom shortcut'}
              </button>
              {!isCapturing && shortcutKey !== '' && !PREDEFINED_SHORTCUTS.some((s) => s.value === shortcutKey) && (
                <span className="font-mono text-sm text-muted-foreground">
                  {formatShortcut(shortcutKey)}
                </span>
              )}
              {isCapturing && (
                <span className="text-xs text-muted-foreground">Esc to cancel</span>
              )}
            </div>

            {/* Current shortcut summary */}
            <p className="mt-3 text-xs text-muted-foreground">
              Current shortcut: <span className="font-mono">{formatShortcut(shortcutKey)}</span>
            </p>
          </>
        )}
      </section>
    </div>
  );
}
