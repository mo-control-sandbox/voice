export interface AudioInputDevice {
  readonly deviceId: string;
  readonly label: string;
}

/**
 * Requests temporary microphone access so device labels become available.
 */
async function warmUpAudioInputAccess(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    stream.getTracks().forEach((track) => {
      // We release the mic immediately because we only need permission/labels.
      track.stop();
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Enumerates available audio input devices after a permission-safe warm-up.
 */
export async function getAudioInputDevices(): Promise<readonly AudioInputDevice[]> {
  const isAudioAvailable = await warmUpAudioInputAccess();
  if (!isAudioAvailable) {
    return [];
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === 'audioinput')
    .filter((device) => device.deviceId.trim() !== '')
    // The MediaDevices API provides no flag to distinguish virtual from physical
    // devices; label inspection is the only option available in the renderer process.
    .filter((device) => !device.label.includes('(Virtual)'))
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label.trim() !== '' ? device.label : `Microphone ${String(index + 1)}`,
    }));
}

/**
 * Registers an audio-device change listener and returns an unsubscribe function.
 */
export function subscribeToAudioInputChanges(listener: () => void): () => void {
  navigator.mediaDevices.addEventListener('devicechange', listener);
  return () => {
    navigator.mediaDevices.removeEventListener('devicechange', listener);
  };
}
