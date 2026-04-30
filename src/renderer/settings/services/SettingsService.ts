import { ipc } from '../../gen/ipc';
import type { SettingsProto } from '../../gen/settings';

/**
 * IPC adapter for the settings domain.
 *
 * Translates setting queries and mutations into main-process calls so that
 * settings page components do not depend on the IPC module directly.
 */
export class SettingsService {
  /** Returns the current persisted settings. */
  async getSettings(): Promise<SettingsProto> {
    return ipc.settings.GetSettings({});
  }

  /**
   * Enables or disables shortcut-capture mode in the main process.
   * While capturing is true, the global shortcut is suspended.
   */
  async setShortcutCaptureMode(capturing: boolean): Promise<void> {
    await ipc.settings.SetShortcutCaptureMode({ capturing });
  }

  /** Persists the save-transcripts preference. */
  async setSaveTranscripts(value: boolean): Promise<void> {
    await ipc.settings.SetSaveTranscripts({ value });
  }

  /** Persists the save-audio preference. */
  async setSaveAudio(value: boolean): Promise<void> {
    await ipc.settings.SetSaveAudio({ value });
  }

  /** Persists the selected audio input device. */
  async setAudioInputDevice(deviceId: string): Promise<void> {
    await ipc.settings.SetAudioInputDevice({ deviceId });
  }

  /** Persists the global shortcut key accelerator string. */
  async setShortcutKey(shortcutKey: string): Promise<void> {
    await ipc.settings.SetShortcutKey({ shortcutKey });
  }

  /** Persists the active model ID in main-process preferences. */
  async setActiveModelId(activeModelId: string): Promise<void> {
    await ipc.settings.SetActiveModelId({ activeModelId });
  }

  /** Persists the preferred primary language in main-process preferences. */
  async setPrimaryLanguage(primaryLanguage: string): Promise<void> {
    await ipc.settings.SetPrimaryLanguage({ primaryLanguage });
  }
}
