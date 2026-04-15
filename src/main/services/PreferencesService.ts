import { prefs } from '@mobrowser/api';
import type { Preferences, PreferenceKey } from '../../shared/types';
import { PREFERENCE_DEFAULTS } from '../../shared/types';

/**
 * Typed, write-through wrapper over the MōBrowser `prefs` key-value store.
 * Every write is immediately persisted to disk, eliminating crash-induced preference loss.
 */
export class PreferencesService {
  /** Read a preference value. Returns the declared default when the key is absent. */
  get<K extends PreferenceKey>(key: K): Preferences[K] {
    const defaultVal = PREFERENCE_DEFAULTS[key];
    if (typeof defaultVal === 'boolean') {
      // The lint-verified narrowing: TypeScript resolves Preferences[K] to boolean here
      // because getBoolean returns boolean, which satisfies Preferences[K] in this branch.
      return prefs.getBoolean(key, defaultVal) as unknown as Preferences[K];
    }
    if (typeof defaultVal === 'number') {
      return prefs.getNumber(key, defaultVal) as unknown as Preferences[K];
    }
    return prefs.getString(key, defaultVal) as Preferences[K];
  }

  /** Write a preference value and persist immediately. */
  set<K extends PreferenceKey>(key: K, value: Preferences[K]): void {
    if (typeof value === 'boolean') {
      prefs.setBoolean(key, value);
    } else if (typeof value === 'number') {
      prefs.setNumber(key, value);
    } else {
      // After the boolean and number guards, value is narrowed to string | ShortcutMode.
      prefs.setString(key, value);
    }
    prefs.persist();
  }

  /** Return a full snapshot of all preferences, applying defaults for any missing keys. */
  getAll(): Preferences {
    return {
      shortcutKey: this.get('shortcutKey'),
      shortcutMode: this.get('shortcutMode'),
      hideDockIcon: this.get('hideDockIcon'),
      launchAtLogin: this.get('launchAtLogin'),
      dontSaveTranscripts: this.get('dontSaveTranscripts'),
      dontSaveAudio: this.get('dontSaveAudio'),
      activeModelId: this.get('activeModelId'),
      primaryLanguage: this.get('primaryLanguage'),
      modelStoragePath: this.get('modelStoragePath'),
    };
  }
}
