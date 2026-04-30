import { useEffect, useRef, useState } from 'react';
import { PermissionStatus, PermissionType } from '../../gen/permissions';
import { getAudioInputDevices, type AudioInputDevice, subscribeToAudioInputChanges } from '../../capabilities/audio/audioInputDevices';
import {
  SETTINGS_PERMISSION_POLL_INTERVAL_MS,
  SETTINGS_PERMISSION_POLL_TIMEOUT_MS,
} from '../../capabilities/permissions/constants';
import { getPermissionStatus } from '../../capabilities/permissions/permissionSnapshot';
import { usePermissionPolling } from '../../capabilities/permissions/usePermissionPolling';
import { PermissionsService } from '../services/PermissionsService';
import { SettingsService } from '../services/SettingsService';

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
  { label: 'Option+Space', value: 'Alt+Space' },
] as const;

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

/**
 * View state exposed by the General settings controller.
 */
export interface GeneralControllerState {
  readonly devices: readonly AudioInputDevice[];
  readonly selectedDeviceId: string;
  readonly shortcutKey: string;
  readonly saveTranscripts: boolean;
  readonly saveAudio: boolean;
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
  readonly handleSaveTranscripts: (value: boolean) => Promise<void>;
  readonly handleSaveAudio: (value: boolean) => Promise<void>;
  readonly handleMicPermissionAction: () => Promise<void>;
}

/**
 * Owns orchestration for the General settings page.
 */
export function useGeneralController(): {
  readonly state: GeneralControllerState;
  readonly actions: GeneralControllerActions;
} {
  const [devices, setDevices] = useState<readonly AudioInputDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [micPermissionStatus, setMicPermissionStatus] = useState<PermissionStatus>(
    PermissionStatus.PERMISSION_STATUS_UNSPECIFIED,
  );
  const [shortcutKey, setShortcutKey] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [saveTranscripts, setSaveTranscripts] = useState(true);
  const [saveAudio, setSaveAudio] = useState(true);
  const [isShortcutLoading, setIsShortcutLoading] = useState(true);
  const [isMicLoading, setIsMicLoading] = useState(true);
  const [isMicPermissionActionLoading, setIsMicPermissionActionLoading] = useState(false);
  const cancelledRef = useRef(false);

  async function refreshMicPermissionStatus(): Promise<PermissionStatus> {
    const response = await permissionsService.refreshPermissions();
    const status = getPermissionStatus(response.permissions, PermissionType.PERMISSION_TYPE_MICROPHONE);
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

  const {
    isPolling: isMicPermissionPolling,
    startPolling: startMicPermissionPolling,
    stopPolling: clearMicPermissionPolling,
  } = usePermissionPolling({
    intervalMs: SETTINGS_PERMISSION_POLL_INTERVAL_MS,
    timeoutMs: SETTINGS_PERMISSION_POLL_TIMEOUT_MS,
    poll: async (): Promise<boolean> => {
      const status = await refreshMicPermissionStatus();
      if (status !== PermissionStatus.PERMISSION_STATUS_GRANTED) {
        return false;
      }
      await loadAudioDevices();
      return true;
    },
  });

  useEffect(() => {
    cancelledRef.current = false;

    async function loadSettings(): Promise<void> {
      try {
        const settingsPromise = settingsService.getSettings().then((settings) => {
          if (cancelledRef.current) return '';
          setShortcutKey(settings.shortcutKey);
          setSaveTranscripts(settings.saveTranscripts);
          setSaveAudio(settings.saveAudio);
          setIsShortcutLoading(false);
          return settings.audioInputDeviceId;
        });

        const permissionsPromise = permissionsService.getPermissions().then((response) => (
          getPermissionStatus(response.permissions, PermissionType.PERMISSION_TYPE_MICROPHONE)
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
  }, [clearMicPermissionPolling]);

  useEffect(() => {
    if (micPermissionStatus !== PermissionStatus.PERMISSION_STATUS_GRANTED) {
      clearMicPermissionPolling();
      return;
    }

    const refreshDevices = (): void => {
      void loadAudioDevices();
    };
    return subscribeToAudioInputChanges(refreshDevices);
  }, [clearMicPermissionPolling, micPermissionStatus]);

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

  async function handleSaveTranscripts(value: boolean): Promise<void> {
    setSaveTranscripts(value);
    await settingsService.setSaveTranscripts(value);
  }

  async function handleSaveAudio(value: boolean): Promise<void> {
    setSaveAudio(value);
    await settingsService.setSaveAudio(value);
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
      saveTranscripts,
      saveAudio,
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
      handleSaveTranscripts,
      handleSaveAudio,
      handleMicPermissionAction,
    },
  };
}
