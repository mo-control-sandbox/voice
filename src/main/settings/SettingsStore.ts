import { ipc, prefs } from '@mobrowser/api';
import { SettingsServiceDescriptor, type SettingsService as SettingsServiceInterface } from '../gen/ipc_service';
import type {
  GetSettingsRequest,
  SetActiveModelIdRequest,
  SetAudioInputDeviceRequest,
  SetBooleanSettingRequest,
  SetPrimaryLanguageRequest,
  SetShortcutCaptureModeRequest,
  SetShortcutKeyRequest,
  SettingsProto,
} from '../gen/settings';
import type { Empty } from '../gen/google/protobuf/empty';
import type { ShortcutManager } from '../system/ShortcutManager';

const DEFAULTS: SettingsProto = {
  saveTranscripts: true,
  saveAudio: true,
  shortcutKey: 'CommandOrControl+Shift+Space',
  audioInputDeviceId: '',
  activeModelId: '',
  primaryLanguage: 'auto',
  showWindowOnAppLaunch: true,
};

/**
 * Stores and persists user settings using MoBrowser preferences store.
 */
export class SettingsStore {
  private readonly shortcutKeyListeners: (() => void)[] = [];
  private readonly onboardingCompletionListeners: (() => void)[] = [];

  /**
   * Returns the current settings read from disk.
   */
  get(): SettingsProto {
    return {
      saveTranscripts: prefs.getBoolean('saveTranscripts', DEFAULTS.saveTranscripts),
      saveAudio: prefs.getBoolean('saveAudio', DEFAULTS.saveAudio),
      shortcutKey: prefs.getString('shortcutKey', DEFAULTS.shortcutKey),
      audioInputDeviceId: prefs.getString('audioInputDeviceId', DEFAULTS.audioInputDeviceId),
      activeModelId: prefs.getString('activeModelId', DEFAULTS.activeModelId),
      primaryLanguage: prefs.getString('primaryLanguage', DEFAULTS.primaryLanguage),
      showWindowOnAppLaunch: prefs.getBoolean('showWindowOnAppLaunch', DEFAULTS.showWindowOnAppLaunch),
    };
  }

  /**
   * Updates the save-transcripts setting and persists to disk.
   */
  setSaveTranscripts(value: boolean): void {
    prefs.setBoolean('saveTranscripts', value);
    prefs.persist();
  }

  /**
   * Updates the save-audio setting and persists to disk.
   */
  setSaveAudio(value: boolean): void {
    prefs.setBoolean('saveAudio', value);
    prefs.persist();
  }

  /**
   * Updates the show-window-on-launch setting and persists to disk.
   */
  setShowWindowOnAppLaunch(value: boolean): void {
    prefs.setBoolean('showWindowOnAppLaunch', value);
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
   * Updates the active model ID and persists to disk.
   */
  setActiveModelId(value: string): void {
    prefs.setString('activeModelId', value);
    prefs.persist();
  }

  /**
   * Updates the preferred language and persists to disk.
   */
  setPrimaryLanguage(value: string): void {
    prefs.setString('primaryLanguage', value);
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
    const wasCompleted = this.hasCompletedOnboarding();
    if (wasCompleted) return;
    prefs.setBoolean('hasCompletedOnboarding', true);
    prefs.persist();
    for (const listener of this.onboardingCompletionListeners) listener();
  }

  /**
   * Registers a listener that fires after onboarding completion state changes.
   */
  onOnboardingCompletionChanged(listener: () => void): void {
    this.onboardingCompletionListeners.push(listener);
  }

  /**
   * Returns whether an active model selection exists.
   */
  isModelReady(): boolean {
    return this.get().activeModelId !== '';
  }

}

/**
 * Registers the Settings IPC service, exposing setting reads and writes to the renderer.
 */
export function registerSettingsIpc(
  settings: SettingsStore,
  shortcutManager: ShortcutManager,
  onModelReadyChanged?: () => void,
): void {
  ipc.registerService(SettingsServiceDescriptor, new SettingsService(settings, shortcutManager, onModelReadyChanged));
}

class SettingsService implements SettingsServiceInterface {
  constructor(
    private readonly settings: SettingsStore,
    private readonly shortcutManager: ShortcutManager,
    private readonly onModelReadyChanged?: () => void,
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

  SetSaveTranscripts(request: SetBooleanSettingRequest) {
    this.settings.setSaveTranscripts(request.value);
    return Promise.resolve({});
  }

  SetSaveAudio(request: SetBooleanSettingRequest) {
    this.settings.setSaveAudio(request.value);
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

  SetActiveModelId(request: SetActiveModelIdRequest): Promise<Empty> {
    this.settings.setActiveModelId(request.activeModelId);
    this.onModelReadyChanged?.();
    return Promise.resolve({});
  }

  SetPrimaryLanguage(request: SetPrimaryLanguageRequest): Promise<Empty> {
    this.settings.setPrimaryLanguage(request.primaryLanguage);
    return Promise.resolve({});
  }

  SetShowWindowOnAppLaunch(request: SetBooleanSettingRequest): Promise<Empty> {
    this.settings.setShowWindowOnAppLaunch(request.value);
    return Promise.resolve({});
  }

  MarkOnboardingComplete(_request: Empty): Promise<Empty> {
    this.settings.setOnboardingCompleted();
    return Promise.resolve({});
  }
}
