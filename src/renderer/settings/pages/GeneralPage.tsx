import { useEffect, useRef, useState } from 'react';
import { SettingsService } from '../services/SettingsService';
import '../components/Switch.css';
import './GeneralPage.css';

const settingsService = new SettingsService();

// ── Audio device picker ────────────────────────────────────────────────────

interface AudioDevice {
  readonly deviceId: string;
  readonly label: string;
}

// ── Shortcut utilities ─────────────────────────────────────────────────────

/**
 * Predefined shortcuts the user can choose with a single click.
 * Keys use MoBrowser accelerator format.
 */
const PREDEFINED_SHORTCUTS: readonly { readonly label: string; readonly value: string }[] = [
  { label: '⌘⇧Space', value: 'CommandOrControl+Shift+Space' },
  { label: '⌘⇧M',     value: 'CommandOrControl+Shift+M'     },
  { label: '⌘⇧R',     value: 'CommandOrControl+Shift+R'     },
  { label: '⌃Space',  value: 'Control+Space'                 },
  { label: '⌥Space',  value: 'Alt+Space'                     },
];

/**
 * Converts a KeyboardEvent into a MoBrowser accelerator string.
 * Returns null for modifier-only keypresses or combos without a modifier.
 */
function buildAccelerator(e: KeyboardEvent): string | null {
  const MODIFIER_KEYS = new Set(['Meta', 'Control', 'Shift', 'Alt', 'Command']);
  if (MODIFIER_KEYS.has(e.key)) return null;

  const parts: string[] = [];
  if (e.metaKey)  parts.push('Command');
  if (e.ctrlKey)  parts.push('Control');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey)   parts.push('Alt');
  if (parts.length === 0) return null;

  let key = e.key;
  if (key === ' ')          key = 'Space';
  else if (key.length === 1) key = key.toUpperCase();

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

/** General settings — audio input, shortcut, and privacy preferences. */
export function GeneralPage(): React.JSX.Element {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [shortcutKey, setShortcutKey] = useState<string>('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [dontSaveTranscripts, setDontSaveTranscripts] = useState(false);
  const [dontSaveAudio, setDontSaveAudio] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const captureRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        tempStream.getTracks().forEach((t) => { t.stop(); });
      } catch { /* Permission denied — device labels will be empty. */ }

      const [settings, allDevices] = await Promise.all([
        settingsService.getSettings(),
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

  // Suspend the global shortcut while capture mode is active so the current
  // hotkey doesn't fire mid-capture.
  useEffect(() => {
    if (!isCapturing) return;

    void settingsService.setShortcutCaptureMode(true);

    function onKeyDown(e: KeyboardEvent): void {
      e.preventDefault();
      if (e.key === 'Escape') { setIsCapturing(false); return; }
      const accelerator = buildAccelerator(e);
      if (accelerator === null) return;
      setIsCapturing(false);
      void saveShortcut(accelerator);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      void settingsService.setShortcutCaptureMode(false);
    };
  }, [isCapturing]);

  async function handleDontSaveTranscripts(value: boolean): Promise<void> {
    setDontSaveTranscripts(value);
    await settingsService.setDontSaveTranscripts(value);
  }

  async function handleDontSaveAudio(value: boolean): Promise<void> {
    setDontSaveAudio(value);
    await settingsService.setDontSaveAudio(value);
  }

  async function handleDeviceChange(deviceId: string): Promise<void> {
    setSelectedDeviceId(deviceId);
    await settingsService.setAudioInputDevice(deviceId);
  }

  async function saveShortcut(accelerator: string): Promise<void> {
    setShortcutKey(accelerator);
    await settingsService.setShortcutKey(accelerator);
  }

  const isCustomShortcut = shortcutKey !== '' && !PREDEFINED_SHORTCUTS.some((s) => s.value === shortcutKey);

  return (
    <div className="general-page">
      <h2 className="general-page__heading">General</h2>

      {/* ── Audio Input ─────────────────────────────────────────────────── */}
      <section className="general-section" aria-labelledby="audio-input-heading">
        <span id="audio-input-heading" className="general-section__label">
          Audio Input
        </span>
        <div className="general-field">
          <label htmlFor="device-select" className="general-field__hint">
            Microphone
          </label>
          {isLoading ? (
            <div className="general-skeleton" aria-label="Loading devices" />
          ) : (
            <select
              id="device-select"
              className="device-select"
              value={selectedDeviceId}
              onChange={(e) => { void handleDeviceChange(e.target.value); }}
            >
              <option value="">System default</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
          )}
          <p className="general-field__hint">
            Selecting a specific device overrides the system default.
          </p>
        </div>
      </section>

      {/* ── Preferences ─────────────────────────────────────────────────── */}
      <section className="general-section" aria-labelledby="preferences-heading">
        <span id="preferences-heading" className="general-section__label">
          Preferences
        </span>
        <div className="toggle-row">
          <span className="toggle-row__label">Don't save transcripts</span>
          <button
            role="switch"
            aria-checked={dontSaveTranscripts}
            aria-label="Don't save transcripts"
            className="switch"
            onClick={() => { void handleDontSaveTranscripts(!dontSaveTranscripts); }}
          >
            <span className="switch__thumb" />
          </button>
        </div>
        <div className="toggle-row">
          <span className="toggle-row__label">Don't save audio</span>
          <button
            role="switch"
            aria-checked={dontSaveAudio}
            aria-label="Don't save audio"
            className="switch"
            onClick={() => { void handleDontSaveAudio(!dontSaveAudio); }}
          >
            <span className="switch__thumb" />
          </button>
        </div>
      </section>

      {/* ── Global Shortcut ─────────────────────────────────────────────── */}
      <section className="general-section" aria-labelledby="shortcut-heading">
        <span id="shortcut-heading" className="general-section__label">
          Global Shortcut
        </span>
        {isLoading ? (
          <div className="general-skeleton" aria-label="Loading shortcuts" />
        ) : (
          <div className="shortcut-section">
            {/* Predefined shortcut pills */}
            <div className="shortcut-presets" role="group" aria-label="Predefined shortcuts">
              {PREDEFINED_SHORTCUTS.map((s) => (
                <button
                  key={s.value}
                  className="shortcut-preset"
                  data-active={shortcutKey === s.value ? 'true' : undefined}
                  aria-pressed={shortcutKey === s.value}
                  onClick={() => { void saveShortcut(s.value); }}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Custom shortcut capture */}
            <div className="shortcut-capture-row">
              <button
                ref={captureRef}
                className="shortcut-capture"
                data-state={isCapturing ? 'capturing' : 'idle'}
                aria-label={isCapturing ? 'Press a key combination' : 'Set a custom shortcut'}
                onClick={() => { setIsCapturing(true); captureRef.current?.focus(); }}
              >
                {isCapturing ? 'Press a shortcut…' : 'Custom…'}
              </button>
              {isCapturing && (
                <span className="shortcut-capture__hint">Esc to cancel</span>
              )}
              {!isCapturing && isCustomShortcut && (
                <span className="shortcut-custom-value" aria-live="polite">
                  {formatShortcut(shortcutKey)}
                </span>
              )}
            </div>

            <p className="shortcut-summary">
              Active:{' '}
              <span className="shortcut-summary__value">
                {shortcutKey !== '' ? formatShortcut(shortcutKey) : '—'}
              </span>
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
