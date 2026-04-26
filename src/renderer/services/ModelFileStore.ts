/**
 * Abstraction for local model file storage.
 *
 * Implementations may back this with the browser Cache API, a local filesystem,
 * S3, or any other store. All methods are keyed by the canonical model ID, not
 * by any source-specific identifier such as a Hugging Face repository path.
 */
export interface ModelFileStore {
  /**
   * Returns true when all files for the given model are available locally.
   */
  isDownloaded(modelId: string): Promise<boolean>;

  /**
   * Fetches and persists all files required for the given model.
   * Calls `onProgress` with a [0, 1] fraction as files are stored.
   */
  download(modelId: string, onProgress: (fraction: number) => void): Promise<void>;

  /**
   * Removes all locally stored files for the given model.
   */
  remove(modelId: string): Promise<void>;
}
