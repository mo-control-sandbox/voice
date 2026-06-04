import { useEffect, useRef, useState } from 'react';
import { PermissionStatus, PermissionType } from '../../gen/permissions';
import { getAudioInputDevices, type AudioInputDevice, subscribeToAudioInputChanges } from '../../infra/audio/audioDevices';
import {
  PermissionSet,
  PERMISSION_POLL_INTERVAL_MS,
} from '../../infra/permissions/PermissionSet';
import { usePermissionPolling } from '../../infra/permissions/usePermissionPolling';
import { PermissionsService } from '../services/PermissionsService';
import { SettingsService } from '../services/SettingsService';

const settingsService = new SettingsService();
const permissionsService = new PermissionsService();

/**
 * Predefined shortcuts the user can choose with a single click.
 */
export const PREDEFINED_SHORTCUTS = [
  { label: '⌘ + ⇧ + Space', value: 'CommandOrControl+Shift+Space' },
  { label: '⌘ + ⇧ + M', value: 'CommandOrControl+Shift+M' },
  { label: '⌘ + ⇧ + R', value: 'CommandOrControl+Shift+R' },
  { label: '⌃ + Space', value: 'Control+Space' },
  { label: '⌥ + Space', value: 'Alt+Space' },
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
 * View state exposed by the settings page controller.
 */
export interface SettingsControllerState {
  readonly devices: readonly AudioInputDevice[];
  readonly selectedDeviceId: string;
  readonly shortcutKey: string;
  readonly saveTranscripts: boolean;
  readonly saveAudio: boolean;
  readonly showWindowOnAppLaunch: boolean;
  readonly openAtLogin: boolean;
  readonly isCapturing: boolean;
  readonly isShortcutLoading: boolean;
  readonly isMicLoading: boolean;
  readonly isMicPermissionActionLoading: boolean;
  readonly isMicPermissionPolling: boolean;
  readonly isMicPermissionGranted: boolean;
  readonly isMicPermissionDenied: boolean;
}

/**
 * Actions exposed by the settings page controller.
 */
export interface SettingsControllerActions {
  readonly setIsCapturing: (capturing: boolean) => void;
  readonly saveShortcut: (accelerator: string) => Promise<void>;
  readonly handleDeviceChange: (deviceId: string) => Promise<void>;
  readonly handleSaveTranscripts: (value: boolean) => Promise<void>;
  readonly handleSaveAudio: (value: boolean) => Promise<void>;
  readonly handleShowWindowOnAppLaunch: (value: boolean) => Promise<void>;
  readonly handleOpenAtLogin: (value: boolean) => Promise<void>;
  readonly handleMicPermissionAction: () => Promise<void>;
}

/**
 * Owns orchestration for the settings page.
 */
export function useSettingsController(): {
  readonly state: SettingsControllerState;
  readonly actions: SettingsControllerActions;
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
  const [showWindowOnAppLaunch, setShowWindowOnAppLaunch] = useState(false);
  const [openAtLogin, setOpenAtLogin] = useState(false);
  const [isShortcutLoading, setIsShortcutLoading] = useState(true);
  const [isMicLoading, setIsMicLoading] = useState(true);
  const [isMicPermissionActionLoading, setIsMicPermissionActionLoading] = useState(false);
  const cancelledRef = useRef(false);

  async function refreshMicPermissionStatus(): Promise<PermissionStatus> {
    const response = await permissionsService.refreshPermissions();
    const status = PermissionSet.fromProto(response.permissions).getMic();
    setMicPermissionStatus(status);
    return status;
  }

  async function loadAudioDevices(): Promise<readonly AudioInputDevice[]> {
    try {
      const deviceList = await getAudioInputDevices();
      if (cancelledRef.current) return [];
      setDevices(deviceList);
      return deviceList;
    } catch {
      if (cancelledRef.current) return [];
      setDevices([]);
      return [];
    }
  }

  const {
    isPolling: isMicPermissionPolling,
    startPolling: startMicPermissionPolling,
    stopPolling: clearMicPermissionPolling,
  } = usePermissionPolling({
    intervalMs: PERMISSION_POLL_INTERVAL_MS,
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
          setShowWindowOnAppLaunch(settings.showWindowOnAppLaunch);
          setOpenAtLogin(settings.openAtLogin);
          setIsShortcutLoading(false);
          return settings.audioInputDeviceId;
        });

        const permissionsPromise = permissionsService.getPermissions().then((response) => (
          PermissionSet.fromProto(response.permissions).getMic()
        ));

        const [savedDeviceId, micStatus] = await Promise.all([settingsPromise, permissionsPromise]);
        if (cancelledRef.current) return;

        setSelectedDeviceId(savedDeviceId);
        setMicPermissionStatus(micStatus);
        if (micStatus === PermissionStatus.PERMISSION_STATUS_GRANTED) {
          const deviceList = await loadAudioDevices();
          if (!cancelledRef.current && savedDeviceId === '' && deviceList.length > 0) {
            const firstId = deviceList[0].deviceId;
            setSelectedDeviceId(firstId);
            await settingsService.setAudioInputDevice(firstId);
          }
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

  async function handleShowWindowOnAppLaunch(value: boolean): Promise<void> {
    setShowWindowOnAppLaunch(value);
    await settingsService.setShowWindowOnAppLaunch(value);
  }

  async function handleOpenAtLogin(value: boolean): Promise<void> {
    setOpenAtLogin(value);
    await settingsService.setOpenAtLogin(value);
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
      showWindowOnAppLaunch,
      openAtLogin,
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
      handleShowWindowOnAppLaunch,
      handleOpenAtLogin,
      handleMicPermissionAction,
    },
  };
}
