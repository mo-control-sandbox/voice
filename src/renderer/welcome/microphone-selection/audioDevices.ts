import type { AudioInputDevice } from '../shared/types';

/**
 * Enumerates available audio input devices after a permission-safe warm-up.
 */
export async function getAudioInputDevices(): Promise<readonly AudioInputDevice[]> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    stream.getTracks().forEach((track) => {
      track.stop();
    });
  } catch {
    return [];
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === 'audioinput')
    .filter((device) => device.deviceId.trim() !== '')
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label.trim() !== '' ? device.label : `Microphone ${String(index + 1)}`,
    }));
}
