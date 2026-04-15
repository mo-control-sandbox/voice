import { dock } from '@mobrowser/api';
import type { SettingsService } from '../gen/ipc_service';
import type { PreferencesResponse, SetPreferenceRequest } from '../gen/settings';
import type { Empty } from '../gen/google/protobuf/empty';
import type { PreferencesService } from '../services/PreferencesService';
import type { ShortcutManager } from '../services/ShortcutManager';
import type { native as NativeBindings } from '../gen/native';
import type { PreferenceKey, Preferences } from '../../shared/types';
import { PREFERENCE_DEFAULTS } from '../../shared/types';

/** All valid preference keys as a runtime set for validation. */
const VALID_KEYS = new Set<string>(Object.keys(PREFERENCE_DEFAULTS));

/**
 * IPC service that exposes preference reads and writes to the renderer process.
 * Parses JSON-encoded values and dispatches side-effects such as shortcut re-registration
 * and login-item toggling when the relevant keys change.
 */
export class SettingsIpcService implements SettingsService {
  constructor(
    private readonly preferences: PreferencesService,
    private readonly shortcutManager: ShortcutManager,
    private readonly native: typeof NativeBindings,
  ) {}

  GetPreferences(_request: Empty): Promise<PreferencesResponse> {
    void _request;
    const all = this.preferences.getAll();
    return Promise.resolve({
      preferences: {
        shortcutKey: all.shortcutKey,
        shortcutMode: all.shortcutMode,
        hideDockIcon: all.hideDockIcon,
        launchAtLogin: all.launchAtLogin,
        dontSaveTranscripts: all.dontSaveTranscripts,
        dontSaveAudio: all.dontSaveAudio,
        activeModelId: all.activeModelId,
        primaryLanguage: all.primaryLanguage,
        modelStoragePath: all.modelStoragePath,
      },
    });
  }

  async SetPreference(request: SetPreferenceRequest): Promise<Empty> {
    const { key, value } = request;
    if (!VALID_KEYS.has(key)) {
      throw new Error(`Unknown preference key: ${key}`);
    }
    const typed = key as PreferenceKey;
    const parsed = JSON.parse(value) as unknown;
    this.preferences.set(typed, parsed as Preferences[typeof typed]);

    if (typed === 'shortcutKey') {
      this.shortcutManager.update(parsed as string);
    }
    if (typed === 'launchAtLogin') {
      await this.native.loginItem.SetLaunchAtLogin({ value: parsed as boolean });
    }
    if (typed === 'hideDockIcon') {
      if (parsed === true) {
        dock.hide();
      } else {
        dock.show();
      }
    }
    return {};
  }
}
