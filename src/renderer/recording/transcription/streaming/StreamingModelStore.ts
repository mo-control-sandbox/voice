/**
 * Owns loading and caching model-specific runtime state for one worker.
 */
export interface StreamingModelStore<TRuntimeHandle> {
  /**
   * Ensures the runtime state for the requested model id is loaded.
   */
  load(modelId: string): Promise<void>;

  /**
   * Returns the currently loaded runtime state when available.
   */
  get(): TRuntimeHandle | null;

  /**
   * Clears all loaded runtime state.
   */
  reset(): void;
}
