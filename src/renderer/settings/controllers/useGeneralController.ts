import { useEffect, useRef, useState } from 'react';
import { PermissionStatus, PermissionType, type PermissionStatusProto } from '../../gen/permissions';
import { PermissionsService } from '../services/PermissionsService';
import { SettingsService } from '../services/SettingsService';

const MIC_PERMISSION_POLL_INTERVAL_MS = 500;
const MIC_PERMISSION_POLL_TIMEOUT_MS = 30_000;

const settingsService = new SettingsService();
const permissionsService = new PermissionsService();

/**
 * Predefined shortcuts the user can choose with a single click.
 */
export const PREDEFINED_SHORTCUTS = [
  { label: 'Cmd+Shift+Space', value: 'CommandOrControl+Shift+Space' },
  { label: 'Cmd+Shift+M', value: 'CommandOrControl+Shift+M' },
  { label: 'Cmd+Shift+R', value: 'CommandOrControl+Shift+R' },
  { label: 'Ctrl+Space', value: 'Control+Space' },
  { label: 'Alt+Space', value: 'Alt+Space' },
] as const;

function permissionStatus(
  permissions: readonly PermissionStatusProto[],
  type: PermissionType,
): PermissionStatus {
  const permission = permissions.find((entry) => entry.type === type);
  return permission?.status ?? PermissionStatus.PERMISSION_STATUS_UNSPECIFIED;
}

/**
 * Converts a KeyboardEvent into a MoBrowser accelerator string.
 */
function buildAccelerator(event: KeyboardEvent): string | null {
  const modifierKeys = new Set(['Meta', 'Control', 'Shift', 'Alt', 'Command']);
  if (modifierKeys.has(event.key)) return null;

  const parts: string[] = [];
  if (event.metaKey) parts.push('Command');
  if (event.ctrlKey) parts.push('Control');
  if (event.shiftKey) parts.push('Shift');
  if (event.altKey) parts.push('Alt');
  if (parts.length === 0) return null;

  let key = event.key;
  if (key === ' ') key = 'Space';
  else if (key.length === 1) key = key.toUpperCase();

  parts.push(key);
  return parts.join('+');
}

async function getAudioInputDevices(): Promise<readonly { deviceId: string; label: string }[]> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    stream.getTracks().forEach((track) => {
      track.stop();
    });
  } catch {
    return [];
  }

  const all = await navigator.mediaDevices.enumerateDevices();
  return all
    .filter((device) => device.kind === 'audioinput')
    .filter((device) => device.deviceId.trim() !== '')
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label.trim() !== '' ? device.label : `Microphone ${String(index + 1)}`,
    }));
}

/**
 * View state exposed by the General settings controller.
 */
export interface GeneralControllerState {
  readonly devices: readonly { deviceId: string; label: string }[];
  readonly selectedDeviceId: string;
  readonly shortcutKey: string;
  readonly dontSaveTranscripts: boolean;
  readonly dontSaveAudio: boolean;
  readonly isCapturing: boolean;
  readonly isShortcutLoading: boolean;
  readonly isMicLoading: boolean;
  readonly isMicPermissionActionLoading: boolean;
  readonly isMicPermissionPolling: boolean;
  readonly isMicPermissionGranted: boolean;
  readonly isMicPermissionDenied: boolean;
}

/**
 * Actions exposed by the General settings controller.
 */
export interface GeneralControllerActions {
  readonly setIsCapturing: (capturing: boolean) => void;
  readonly saveShortcut: (accelerator: string) => Promise<void>;
  readonly handleDeviceChange: (deviceId: string) => Promise<void>;
  readonly handleDontSaveTranscripts: (value: boolean) => Promise<void>;
  readonly handleDontSaveAudio: (value: boolean) => Promise<void>;
  readonly handleMicPermissionAction: () => Promise<void>;
}

/**
 * Owns orchestration for the General settings page.
 */
export function useGeneralController(): {
  readonly state: GeneralControllerState;
  readonly actions: GeneralControllerActions;
} {
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
    pollIntervalRef.current = setInterval(() => {
      void runPoll();
    }, MIC_PERMISSION_POLL_INTERVAL_MS);
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
    const refreshDevices = (): void => {
      void loadAudioDevices();
    };

    mediaDevices.addEventListener('devicechange', refreshDevices);
    return () => {
      mediaDevices.removeEventListener('devicechange', refreshDevices);
    };
  }, [micPermissionStatus]);

  useEffect(() => {
    if (!isCapturing) return;

    void settingsService.setShortcutCaptureMode(true);

    function onKeyDown(event: KeyboardEvent): void {
      event.preventDefault();
      if (event.key === 'Escape') {
        setIsCapturing(false);
        return;
      }

      const accelerator = buildAccelerator(event);
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

  return {
    state: {
      devices,
      selectedDeviceId,
      shortcutKey,
      dontSaveTranscripts,
      dontSaveAudio,
      isCapturing,
      isShortcutLoading,
      isMicLoading,
      isMicPermissionActionLoading,
      isMicPermissionPolling,
      isMicPermissionGranted: micPermissionStatus === PermissionStatus.PERMISSION_STATUS_GRANTED,
      isMicPermissionDenied: micPermissionStatus === PermissionStatus.PERMISSION_STATUS_DENIED,
    },
    actions: {
      setIsCapturing,
      saveShortcut,
      handleDeviceChange,
      handleDontSaveTranscripts,
      handleDontSaveAudio,
      handleMicPermissionAction,
    },
  };
}
