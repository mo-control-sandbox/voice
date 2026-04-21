import { useEffect, useRef, useState } from 'react';
import { SettingsService } from '../services/SettingsService';

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
  { label: 'Cmd+Shift+Space', value: 'CommandOrControl+Shift+Space' },
  { label: 'Cmd+Shift+M',     value: 'CommandOrControl+Shift+M'     },
  { label: 'Cmd+Shift+R',     value: 'CommandOrControl+Shift+R'     },
  { label: 'Ctrl+Space',      value: 'Control+Space'                 },
  { label: 'Alt+Space',       value: 'Alt+Space'                     },
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

// ── Page ───────────────────────────────────────────────────────────────────

/** General settings -- audio input, shortcut, and privacy preferences. */
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
      } catch { /* Permission denied -- device labels will be empty. */ }

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

  if (isLoading) return <p>Loading...</p>;

  return (
    <div>
      <div>
        <label>
          Microphone:
          <select
            value={selectedDeviceId}
            onChange={(e) => { void handleDeviceChange(e.target.value); }}
          >
            <option value="">System default</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            checked={dontSaveTranscripts}
            onChange={(e) => { void handleDontSaveTranscripts(e.target.checked); }}
          />
          Don't save transcripts
        </label>
        <label>
          <input
            type="checkbox"
            checked={dontSaveAudio}
            onChange={(e) => { void handleDontSaveAudio(e.target.checked); }}
          />
          Don't save audio
        </label>
      </div>

      <div>
        <p>Shortcut: {shortcutKey !== '' ? shortcutKey : '—'}</p>
        {PREDEFINED_SHORTCUTS.map((s) => (
          <button
            key={s.value}
            disabled={shortcutKey === s.value}
            onClick={() => { void saveShortcut(s.value); }}
          >
            {s.label}
          </button>
        ))}
        <button
          ref={captureRef}
          onClick={() => { setIsCapturing(true); captureRef.current?.focus(); }}
        >
          {isCapturing ? 'Press a shortcut... (Esc to cancel)' : 'Custom...'}
        </button>
      </div>
    </div>
  );
}
