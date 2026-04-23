import { ipc, prefs } from '@mobrowser/api';
import { SettingsService as createSettingsService, type SettingsService as SettingsServiceInterface } from '../gen/ipc_service';
import type {
  GetSettingsRequest,
  SetAudioInputDeviceRequest,
  SetBooleanSettingRequest,
  SetShortcutCaptureModeRequest,
  SetShortcutKeyRequest,
  SettingsProto,
} from '../gen/settings';
import type { Empty } from '../gen/google/protobuf/empty';
import type { ShortcutManager } from '../system/ShortcutManager';

const DEFAULTS: SettingsProto = {
  dontSaveTranscripts: false,
  dontSaveAudio: false,
  shortcutKey: 'CommandOrControl+Shift+Space',
  audioInputDeviceId: '',
};

/**
 * Stores and persists user settings using MoBrowser preferences store.
 */
export class SettingsStore {
  private readonly shortcutKeyListeners: (() => void)[] = [];

  /**
   * Returns the current settings read from disk.
   */
  get(): SettingsProto {
    return {
      dontSaveTranscripts: prefs.getBoolean('dontSaveTranscripts', DEFAULTS.dontSaveTranscripts),
      dontSaveAudio: prefs.getBoolean('dontSaveAudio', DEFAULTS.dontSaveAudio),
      shortcutKey: prefs.getString('shortcutKey', DEFAULTS.shortcutKey),
      audioInputDeviceId: prefs.getString('audioInputDeviceId', DEFAULTS.audioInputDeviceId),
    };
  }

  /**
   * Updates the dont-save-transcripts setting and persists to disk.
   */
  setDontSaveTranscripts(value: boolean): void {
    prefs.setBoolean('dontSaveTranscripts', value);
    prefs.persist();
  }

  /**
   * Updates the dont-save-audio setting and persists to disk.
   */
  setDontSaveAudio(value: boolean): void {
    prefs.setBoolean('dontSaveAudio', value);
    prefs.persist();
  }

  /**
   * Registers a listener that fires after the shortcut key is changed.
   */
  onShortcutKeyChanged(listener: () => void): void {
    this.shortcutKeyListeners.push(listener);
  }

  /**
   * Updates the shortcut key setting and persists to disk.
   */
  setShortcutKey(value: string): void {
    prefs.setString('shortcutKey', value);
    prefs.persist();
    for (const listener of this.shortcutKeyListeners) listener();
  }

  /**
   * Updates the audio input device ID and persists to disk.
   */
  setAudioInputDeviceId(value: string): void {
    prefs.setString('audioInputDeviceId', value);
    prefs.persist();
  }

  /**
   * Returns whether the user has completed the first-launch onboarding wizard.
   */
  hasCompletedOnboarding(): boolean {
    return prefs.getBoolean('hasCompletedOnboarding', false);
  }

  /**
   * Marks the onboarding wizard as completed and persists to disk.
   */
  setOnboardingCompleted(): void {
    prefs.setBoolean('hasCompletedOnboarding', true);
    prefs.persist();
  }

  /**
   * Returns whether the renderer has reported a downloaded, active model.
   */
  isModelReady(): boolean {
    return prefs.getBoolean('modelReady', false);
  }

  /**
   * Stores the latest model readiness state reported by the renderer.
   */
  setModelReady(value: boolean): void {
    prefs.setBoolean('modelReady', value);
    prefs.persist();
  }
}

/**
 * Registers the Settings IPC service, exposing setting reads and writes to the renderer.
 */
export function registerSettingsIpc(
  settings: SettingsStore,
  shortcutManager: ShortcutManager,
): void {
  ipc.registerService(createSettingsService(new SettingsService(settings, shortcutManager)));
}

class SettingsService implements SettingsServiceInterface {
  constructor(
    private readonly settings: SettingsStore,
    private readonly shortcutManager: ShortcutManager,
  ) {}

  GetSettings(_request: GetSettingsRequest) {
    return Promise.resolve(this.settings.get());
  }

  SetAudioInputDevice(request: SetAudioInputDeviceRequest) {
    this.settings.setAudioInputDeviceId(request.deviceId);
    return Promise.resolve({});
  }

  SetShortcutKey(request: SetShortcutKeyRequest) {
    this.settings.setShortcutKey(request.shortcutKey);
    this.shortcutManager.updateKey(request.shortcutKey);
    return Promise.resolve({});
  }

  SetDontSaveTranscripts(request: SetBooleanSettingRequest) {
    this.settings.setDontSaveTranscripts(request.value);
    return Promise.resolve({});
  }

  SetDontSaveAudio(request: SetBooleanSettingRequest) {
    this.settings.setDontSaveAudio(request.value);
    return Promise.resolve({});
  }

  SetShortcutCaptureMode(request: SetShortcutCaptureModeRequest) {
    if (request.capturing) {
      this.shortcutManager.pause();
    } else {
      this.shortcutManager.resume();
    }
    return Promise.resolve({});
  }

  MarkOnboardingComplete(_request: Empty): Promise<Empty> {
    this.settings.setOnboardingCompleted();
    return Promise.resolve({});
  }

  SetModelReady(request: SetBooleanSettingRequest): Promise<Empty> {
    this.settings.setModelReady(request.value);
    return Promise.resolve({});
  }
}
