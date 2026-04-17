import type { ModelStateStore } from './ModelStateStore';

const KEY_ACTIVE_MODEL_ID = 'movoice:activeModelId';
const KEY_PRIMARY_LANGUAGE = 'movoice:primaryLanguage';

const DEFAULT_ACTIVE_MODEL_ID = 'builtin';
const DEFAULT_LANGUAGE = 'auto';

/**
 * ModelStateStore implementation that persists the user's active model selection
 * and preferred transcription language across sessions using localStorage.
 */
export class RendererModelStateStore implements ModelStateStore {
  /**
   * Returns the stored active model ID, falling back to 'builtin' if not set.
   */
  getActiveModelId(): string {
    return localStorage.getItem(KEY_ACTIVE_MODEL_ID) ?? DEFAULT_ACTIVE_MODEL_ID;
  }

  /**
   * Stores the given model ID as the active selection.
   */
  setActiveModelId(id: string): void {
    localStorage.setItem(KEY_ACTIVE_MODEL_ID, id);
  }

  /**
   * Returns the stored language code, falling back to 'auto' if not set.
   */
  getLanguage(): string {
    return localStorage.getItem(KEY_PRIMARY_LANGUAGE) ?? DEFAULT_LANGUAGE;
  }

  /**
   * Stores the given language code as the preferred transcription language.
   */
  setLanguage(language: string): void {
    localStorage.setItem(KEY_PRIMARY_LANGUAGE, language);
  }
}
