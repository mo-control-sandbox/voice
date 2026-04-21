import { ipc } from '../../gen/ipc';

/**
 * IPC adapter for the settings domain.
 *
 * Translates setting queries and mutations into main-process calls so that
 * settings page components do not depend on the IPC module directly.
 */
export class SettingsService {
  /** Returns the current persisted settings. */
  async getSettings() {
    return ipc.settings.GetSettings({});
  }

  /**
   * Enables or disables shortcut-capture mode in the main process.
   * While capturing is true, the global shortcut is suspended.
   */
  async setShortcutCaptureMode(capturing: boolean): Promise<void> {
    await ipc.settings.SetShortcutCaptureMode({ capturing });
  }

  /** Persists the dont-save-transcripts preference. */
  async setDontSaveTranscripts(value: boolean): Promise<void> {
    await ipc.settings.SetDontSaveTranscripts({ value });
  }

  /** Persists the dont-save-audio preference. */
  async setDontSaveAudio(value: boolean): Promise<void> {
    await ipc.settings.SetDontSaveAudio({ value });
  }

  /** Persists the selected audio input device. */
  async setAudioInputDevice(deviceId: string): Promise<void> {
    await ipc.settings.SetAudioInputDevice({ deviceId });
  }

  /** Persists the global shortcut key accelerator string. */
  async setShortcutKey(shortcutKey: string): Promise<void> {
    await ipc.settings.SetShortcutKey({ shortcutKey });
  }
}
