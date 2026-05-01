
import { SettingsService } from '../settings/services/SettingsService';

const LEGACY_KEY_ACTIVE_MODEL_ID = 'movoice:activeModelId';
const LEGACY_KEY_PRIMARY_LANGUAGE = 'movoice:primaryLanguage';

const DEFAULT_ACTIVE_MODEL_ID = '';
const DEFAULT_LANGUAGE = 'auto';

/**
 * ModelStateStore implementation that persists the user's active model selection
 * and preferred transcription language across sessions using main-process prefs.
 */
export class ModelStateStore {
  private readonly settingsService = new SettingsService();
  private migrationPromise: Promise<void> | null = null;

  /**
   * Returns the stored active model ID, falling back to empty string if not set.
   */
  async getActiveModelId(): Promise<string> {
    await this.ensureLegacyMigration();
    const settings = await this.settingsService.getSettings();
    return settings.activeModelId || DEFAULT_ACTIVE_MODEL_ID;
  }

  /**
   * Stores the given model ID as the active selection.
   */
  async setActiveModelId(id: string): Promise<void> {
    await this.settingsService.setActiveModelId(id);
  }

  /**
   * Returns the stored language code, falling back to 'auto' if not set.
   */
  async getLanguage(): Promise<string> {
    await this.ensureLegacyMigration();
    const settings = await this.settingsService.getSettings();
    return settings.primaryLanguage || DEFAULT_LANGUAGE;
  }

  /**
   * Stores the given language code as the preferred transcription language.
   */
  async setLanguage(language: string): Promise<void> {
    await this.settingsService.setPrimaryLanguage(language);
  }

  private async ensureLegacyMigration(): Promise<void> {
    this.migrationPromise ??= this.runLegacyMigration();
    await this.migrationPromise;
  }

  private async runLegacyMigration(): Promise<void> {
    const settings = await this.settingsService.getSettings();
    const nextActiveModelId = settings.activeModelId !== ''
      ? settings.activeModelId
      : (localStorage.getItem(LEGACY_KEY_ACTIVE_MODEL_ID) ?? '');
    const nextLanguage = settings.primaryLanguage !== ''
      ? settings.primaryLanguage
      : (localStorage.getItem(LEGACY_KEY_PRIMARY_LANGUAGE) ?? DEFAULT_LANGUAGE);

    if (!settings.activeModelId && nextActiveModelId !== '') {
      await this.settingsService.setActiveModelId(nextActiveModelId);
    }
    if (!settings.primaryLanguage && nextLanguage !== '') {
      await this.settingsService.setPrimaryLanguage(nextLanguage);
    }
  }
}
