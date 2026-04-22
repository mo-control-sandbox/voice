import { useEffect, useRef, useState } from 'react';
import { Switch } from '../components/Switch';
import { SettingsService } from '../services/SettingsService';
import './GeneralPage.css';

const settingsService = new SettingsService();

/** Predefined shortcuts the user can choose with a single click. */
const PREDEFINED_SHORTCUTS = [
  { label: 'Cmd+Shift+Space', value: 'CommandOrControl+Shift+Space' },
  { label: 'Cmd+Shift+M',     value: 'CommandOrControl+Shift+M'     },
  { label: 'Cmd+Shift+R',     value: 'CommandOrControl+Shift+R'     },
  { label: 'Ctrl+Space',      value: 'Control+Space'                 },
  { label: 'Alt+Space',       value: 'Alt+Space'                     },
] as const;

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
  if (key === ' ')           key = 'Space';
  else if (key.length === 1) key = key.toUpperCase();

  parts.push(key);
  return parts.join('+');
}

/** General settings -- audio input, global shortcut, and privacy preferences. */
export function GeneralPage(): React.JSX.Element {
  const [devices, setDevices] = useState<readonly { deviceId: string; label: string }[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [shortcutKey, setShortcutKey] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [dontSaveTranscripts, setDontSaveTranscripts] = useState(false);
  const [dontSaveAudio, setDontSaveAudio] = useState(false);
  const [isShortcutLoading, setIsShortcutLoading] = useState(true);
  const [isMicLoading, setIsMicLoading] = useState(true);
  const captureRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Settings load fast: drives shortcut key and privacy toggles immediately.
    const settingsPromise = settingsService.getSettings().then((settings) => {
      setShortcutKey(settings.shortcutKey);
      setDontSaveTranscripts(settings.dontSaveTranscripts);
      setDontSaveAudio(settings.dontSaveAudio);
      setIsShortcutLoading(false);
      return settings.audioInputDeviceId;
    });

    // Device enumeration may be slower: requires getUserMedia to populate labels.
    const devicesPromise = (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        stream.getTracks().forEach((t) => { t.stop(); });
      } catch { /* Permission not yet granted -- device labels may be empty. */ }
      const all = await navigator.mediaDevices.enumerateDevices();
      return all
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label || d.deviceId }));
    })();

    // Mic section needs both the saved device ID and the device list.
    void Promise.all([settingsPromise, devicesPromise]).then(([savedDeviceId, deviceList]) => {
      setSelectedDeviceId(savedDeviceId);
      setDevices(deviceList);
      setIsMicLoading(false);
    });
  }, []);

  // Suspend the global shortcut during key capture so the current hotkey
  // doesn't fire while the user is pressing a new one.
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

  async function saveShortcut(accelerator: string): Promise<void> {
    setShortcutKey(accelerator);
    await settingsService.setShortcutKey(accelerator);
  }

  async function handleDeviceChange(deviceId: string): Promise<void> {
    setSelectedDeviceId(deviceId);
    await settingsService.setAudioInputDevice(deviceId);
  }

  async function handleDontSaveTranscripts(value: boolean): Promise<void> {
    setDontSaveTranscripts(value);
    await settingsService.setDontSaveTranscripts(value);
  }

  async function handleDontSaveAudio(value: boolean): Promise<void> {
    setDontSaveAudio(value);
    await settingsService.setDontSaveAudio(value);
  }

  const isPredefined = PREDEFINED_SHORTCUTS.some((s) => s.value === shortcutKey);
  const customLabel  = !isPredefined && shortcutKey !== '' ? shortcutKey : null;

  return (
    <div className="general-page">
      <h1 className="general-page__heading">General</h1>

      {/* ── Privacy ─────────────────────────────────────────────────────── */}
      <section className="general-section">
        <span className="general-section__label">Privacy</span>
        <div className="toggle-row">
          <label htmlFor="no-transcripts" className="toggle-row__label">
            Don't save transcripts
          </label>
          <Switch
            id="no-transcripts"
            checked={dontSaveTranscripts}
            onChange={(v) => { void handleDontSaveTranscripts(v); }}
          />
        </div>
        <div className="toggle-row">
          <label htmlFor="no-audio" className="toggle-row__label">
            Don't save audio
          </label>
          <Switch
            id="no-audio"
            checked={dontSaveAudio}
            onChange={(v) => { void handleDontSaveAudio(v); }}
          />
        </div>
      </section>

      {/* ── Input ───────────────────────────────────────────────────────── */}
      <section className="general-section">
        <span className="general-section__label">Input</span>
        {isMicLoading ? (
          <div className="general-skeleton" />
        ) : (
          <div className="general-field">
            <label htmlFor="mic-select" className="toggle-row__label">Microphone</label>
            <select
              id="mic-select"
              className="device-select"
              value={selectedDeviceId}
              onChange={(e) => { void handleDeviceChange(e.target.value); }}
            >
              <option value="">System default</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
              ))}
            </select>
          </div>
        )}
      </section>

      {/* ── Shortcut ────────────────────────────────────────────────────── */}
      <section className="general-section">
        <span className="general-section__label">Shortcut</span>
        {isShortcutLoading ? (
          <div className="general-skeleton" />
        ) : (
          <div className="shortcut-section">
            <div className="shortcut-presets">
              {PREDEFINED_SHORTCUTS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className="shortcut-preset"
                  data-active={shortcutKey === s.value ? 'true' : undefined}
                  onClick={() => { void saveShortcut(s.value); }}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="shortcut-capture-row">
              <button
                ref={captureRef}
                type="button"
                className="shortcut-capture"
                data-state={isCapturing ? 'capturing' : undefined}
                onClick={() => { setIsCapturing(true); captureRef.current?.focus(); }}
              >
                {isCapturing ? 'Press a key... (Esc to cancel)' : 'Custom...'}
              </button>
              {customLabel !== null && (
                <span className="shortcut-custom-value">{customLabel}</span>
              )}
            </div>
            {shortcutKey !== '' && (
              <span className="shortcut-summary">
                Active shortcut: <span className="shortcut-summary__value">{shortcutKey}</span>
              </span>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
