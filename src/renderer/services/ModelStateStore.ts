/**
 * Persists the user's active model selection and preferred transcription language.
 *
 * Implementations may use localStorage, a remote settings service, or any
 * other durable store.
 */
export interface ModelStateStore {
  /**
   * Returns the stored active model ID.
   */
  getActiveModelId(): Promise<string>;

  /**
   * Stores the given model ID as the active selection.
   */
  setActiveModelId(id: string): Promise<void>;

  /**
   * Returns the stored language code (e.g. 'en', 'auto').
   */
  getLanguage(): Promise<string>;

  /**
   * Stores the given language code as the preferred transcription language.
   */
  setLanguage(language: string): Promise<void>;
}
