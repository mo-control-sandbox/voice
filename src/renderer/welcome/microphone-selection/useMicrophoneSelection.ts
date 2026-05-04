import { useCallback, useEffect, useRef, useState } from 'react';
import { getAudioInputDevices, subscribeToAudioInputChanges, type AudioInputDevice } from '../../infra/audio/audioDevices';
import { SettingsService } from '../../settings/services/SettingsService';

const settingsService = new SettingsService();

interface LoadAudioDevicesOptions {
  readonly showLoading?: boolean;
}

/**
 * Owns microphone device discovery and selection for onboarding.
 */
export function useMicrophoneSelection(params: {
  readonly isStepActive: boolean;
  readonly isMicrophoneGranted: boolean;
}): {
  readonly audioDevices: readonly AudioInputDevice[];
  readonly audioDevicesLoading: boolean;
  readonly selectedAudioDeviceId: string;
  readonly loadSelectedAudioDeviceId: () => Promise<void>;
  readonly handleAudioDeviceChange: (deviceId: string) => Promise<void>;
} {
  const { isStepActive, isMicrophoneGranted } = params;
  const [audioDevices, setAudioDevices] = useState<readonly AudioInputDevice[]>([]);
  const [audioDevicesLoading, setAudioDevicesLoading] = useState(false);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState('');
  const hasLoadedAudioDevicesRef = useRef(false);

  const loadAudioDevices = useCallback(async (options?: LoadAudioDevicesOptions): Promise<void> => {
    const showLoading = options?.showLoading ?? !hasLoadedAudioDevicesRef.current;
    if (showLoading) {
      setAudioDevicesLoading(true);
    }

    try {
      const devices = await getAudioInputDevices();
      setAudioDevices(devices);
      if (devices.length > 0) {
        const selectedExists = devices.some((device) => device.deviceId === selectedAudioDeviceId);
        if (!selectedExists && selectedAudioDeviceId !== '') {
          setSelectedAudioDeviceId('');
          await settingsService.setAudioInputDevice('');
        }
      }
    } finally {
      hasLoadedAudioDevicesRef.current = true;
      if (showLoading) {
        setAudioDevicesLoading(false);
      }
    }
  }, [selectedAudioDeviceId]);

  useEffect(() => {
    if (isStepActive && isMicrophoneGranted) {
      void loadAudioDevices({ showLoading: !hasLoadedAudioDevicesRef.current });
      const onDeviceChange = (): void => {
        void loadAudioDevices({ showLoading: false });
      };
      return subscribeToAudioInputChanges(onDeviceChange);
    }

    return undefined;
  }, [isMicrophoneGranted, isStepActive, loadAudioDevices]);

  const loadSelectedAudioDeviceId = useCallback(async (): Promise<void> => {
    const settings = await settingsService.getSettings();
    setSelectedAudioDeviceId(settings.audioInputDeviceId);
  }, []);

  const handleAudioDeviceChange = useCallback(async (deviceId: string): Promise<void> => {
    setSelectedAudioDeviceId(deviceId);
    await settingsService.setAudioInputDevice(deviceId);
  }, []);

  return {
    audioDevices,
    audioDevicesLoading,
    selectedAudioDeviceId,
    loadSelectedAudioDeviceId,
    handleAudioDeviceChange,
  };
}
