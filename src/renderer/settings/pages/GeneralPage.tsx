import { useEffect, useRef, useState } from 'react';
import { PermissionStatus, PermissionType, type PermissionStatusProto } from '../../gen/permissions';
import { Switch } from '../components/Switch';
import { PermissionsService } from '../services/PermissionsService';
import { SettingsService } from '../services/SettingsService';
import './GeneralPage.css';

const settingsService = new SettingsService();
const permissionsService = new PermissionsService();
const MIC_PERMISSION_POLL_INTERVAL_MS = 500;
const MIC_PERMISSION_POLL_TIMEOUT_MS = 30_000;

/** Predefined shortcuts the user can choose with a single click. */
const PREDEFINED_SHORTCUTS = [
  { label: 'Cmd+Shift+Space', value: 'CommandOrControl+Shift+Space' },
  { label: 'Cmd+Shift+M',     value: 'CommandOrControl+Shift+M'     },
  { label: 'Cmd+Shift+R',     value: 'CommandOrControl+Shift+R'     },
  { label: 'Ctrl+Space',      value: 'Control+Space'                 },
  { label: 'Alt+Space',       value: 'Alt+Space'                     },
] as const;

interface GeneralPageProps {
  readonly onOpenPermissions: () => void;
}

function permissionStatus(
  permissions: readonly PermissionStatusProto[],
  type: PermissionType,
): PermissionStatus {
  const permission = permissions.find((entry) => entry.type === type);
  return permission?.status ?? PermissionStatus.PERMISSION_STATUS_UNSPECIFIED;
}

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

async function getAudioInputDevices(): Promise<readonly { deviceId: string; label: string }[]> {
  try {
    // Match the working project behavior: warm up media permission/labels first.
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    stream.getTracks().forEach((track) => { track.stop(); });
  } catch {
    return [];
  }

  const all = await navigator.mediaDevices.enumerateDevices();
  return all
    .filter((d) => d.kind === 'audioinput')
    .filter((d) => d.deviceId.trim() !== '')
    .map((d, index) => ({
      deviceId: d.deviceId,
      label: d.label.trim() !== '' ? d.label : `Microphone ${String(index + 1)}`,
    }));
}

/**
 * General settings -- audio input, global shortcut, and privacy preferences.
 */
export function GeneralPage({ onOpenPermissions }: GeneralPageProps): React.JSX.Element {
  const [devices, setDevices] = useState<readonly { deviceId: string; label: string }[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [micPermissionStatus, setMicPermissionStatus] = useState<PermissionStatus>(
    PermissionStatus.PERMISSION_STATUS_UNSPECIFIED,
  );
  const [shortcutKey, setShortcutKey] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [dontSaveTranscripts, setDontSaveTranscripts] = useState(false);
  const [dontSaveAudio, setDontSaveAudio] = useState(false);
  const [isShortcutLoading, setIsShortcutLoading] = useState(true);
  const [isMicLoading, setIsMicLoading] = useState(true);
  const [isMicPermissionActionLoading, setIsMicPermissionActionLoading] = useState(false);
  const [isMicPermissionPolling, setIsMicPermissionPolling] = useState(false);
  const captureRef = useRef<HTMLButtonElement>(null);
  const cancelledRef = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearMicPermissionPolling(): void {
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (pollTimeoutRef.current !== null) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    setIsMicPermissionPolling(false);
  }

  async function refreshMicPermissionStatus(): Promise<PermissionStatus> {
    const response = await permissionsService.refreshPermissions();
    const status = permissionStatus(response.permissions, PermissionType.PERMISSION_TYPE_MICROPHONE);
    setMicPermissionStatus(status);
    return status;
  }

  async function loadAudioDevices(): Promise<void> {
    try {
      const deviceList = await getAudioInputDevices();
      if (cancelledRef.current) return;
      setDevices(deviceList);
    } catch {
      if (cancelledRef.current) return;
      setDevices([]);
    }
  }

  function startMicPermissionPolling(): void {
    clearMicPermissionPolling();
    setIsMicPermissionPolling(true);

    let pollInFlight = false;
    const runPoll = async (): Promise<void> => {
      if (pollInFlight) return;
      pollInFlight = true;
      try {
        const status = await refreshMicPermissionStatus();
        if (status === PermissionStatus.PERMISSION_STATUS_GRANTED) {
          await loadAudioDevices();
          clearMicPermissionPolling();
        }
      } finally {
        pollInFlight = false;
      }
    };

    void runPoll();
    pollIntervalRef.current = setInterval(() => { void runPoll(); }, MIC_PERMISSION_POLL_INTERVAL_MS);
    pollTimeoutRef.current = setTimeout(() => {
      clearMicPermissionPolling();
    }, MIC_PERMISSION_POLL_TIMEOUT_MS);
  }

  useEffect(() => {
    cancelledRef.current = false;

    async function loadSettings(): Promise<void> {
      try {
        const settingsPromise = settingsService.getSettings().then((settings) => {
          if (cancelledRef.current) return '';
          setShortcutKey(settings.shortcutKey);
          setDontSaveTranscripts(settings.dontSaveTranscripts);
          setDontSaveAudio(settings.dontSaveAudio);
          setIsShortcutLoading(false);
          return settings.audioInputDeviceId;
        });
        const permissionsPromise = permissionsService.getPermissions().then((response) => (
          permissionStatus(response.permissions, PermissionType.PERMISSION_TYPE_MICROPHONE)
        ));

        const [savedDeviceId, micStatus] = await Promise.all([settingsPromise, permissionsPromise]);
        if (cancelledRef.current) return;

        setSelectedDeviceId(savedDeviceId);
        setMicPermissionStatus(micStatus);
        if (micStatus === PermissionStatus.PERMISSION_STATUS_GRANTED) {
          await loadAudioDevices();
        } else {
          setDevices([]);
        }
      } catch {
        if (cancelledRef.current) return;
        setIsShortcutLoading(false);
        setMicPermissionStatus(PermissionStatus.PERMISSION_STATUS_UNSPECIFIED);
        setDevices([]);
      } finally {
        if (!cancelledRef.current) {
          setIsMicLoading(false);
        }
      }
    }

    void loadSettings();
    return () => {
      cancelledRef.current = true;
      clearMicPermissionPolling();
    };
  }, []);

  useEffect(() => {
    if (micPermissionStatus !== PermissionStatus.PERMISSION_STATUS_GRANTED) {
      clearMicPermissionPolling();
      return;
    }

    const mediaDevices = navigator.mediaDevices;
    const refreshDevices = (): void => { void loadAudioDevices(); };
    mediaDevices.addEventListener('devicechange', refreshDevices);
    return () => {
      mediaDevices.removeEventListener('devicechange', refreshDevices);
    };
  }, [micPermissionStatus]);

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

  async function handleMicPermissionAction(): Promise<void> {
    setIsMicPermissionActionLoading(true);
    try {
      if (micPermissionStatus === PermissionStatus.PERMISSION_STATUS_DENIED) {
        await permissionsService.openSystemSettings(PermissionType.PERMISSION_TYPE_MICROPHONE);
        startMicPermissionPolling();
        return;
      }

      await permissionsService.requestPermission(PermissionType.PERMISSION_TYPE_MICROPHONE);
      const updatedStatus = await refreshMicPermissionStatus();
      if (updatedStatus === PermissionStatus.PERMISSION_STATUS_GRANTED) {
        await loadAudioDevices();
      }
    } finally {
      setIsMicPermissionActionLoading(false);
    }
  }

  const isPredefined = PREDEFINED_SHORTCUTS.some((s) => s.value === shortcutKey);
  const customLabel  = !isPredefined && shortcutKey !== '' ? shortcutKey : null;
  const isMicPermissionGranted = micPermissionStatus === PermissionStatus.PERMISSION_STATUS_GRANTED;
  const isMicPermissionDenied = micPermissionStatus === PermissionStatus.PERMISSION_STATUS_DENIED;
  const micPermissionTitle = isMicPermissionDenied
    ? 'Microphone access is off'
    : 'Microphone access is needed';
  const micPermissionDescription = isMicPermissionDenied
    ? 'Open System Settings and enable microphone access for MoVoice, then return here.'
    : 'Allow microphone access to choose your input device.';
  const micPermissionButtonLabel = isMicPermissionDenied ? 'Open System Settings' : 'Allow Access';
  const isMicPermissionButtonDisabled = isMicPermissionActionLoading || isMicPermissionPolling;

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
        ) : !isMicPermissionGranted ? (
          <div className="general-permission-card">
            <span className="general-permission-card__title">{micPermissionTitle}</span>
            <span className="general-permission-card__description">
              {micPermissionDescription}
            </span>
            <button
              type="button"
              className="general-permission-card__link"
              disabled={isMicPermissionButtonDisabled}
              onClick={() => { void handleMicPermissionAction(); }}
            >
              {isMicPermissionPolling ? 'Checking...' : micPermissionButtonLabel}
            </button>
          </div>
        ) : devices.length === 0 ? (
          <div className="general-permission-card">
            <span className="general-permission-card__title">No microphone devices available</span>
            <span className="general-permission-card__description">
              Open the Permissions page and allow microphone access, then return here.
            </span>
            <button
              type="button"
              className="general-permission-card__link"
              onClick={onOpenPermissions}
            >
              Open Permissions
            </button>
          </div>
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
