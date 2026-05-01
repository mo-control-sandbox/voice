/**
 * Determines which worker and loading strategy a model uses.
 * Adding a new value here signals a new code path in BackendFactory and its worker.
 */
export type InferenceMode = 'batch-transformers' | 'voxtral-realtime';

/** A model from the bundled catalog. */
export interface ModelDefinition {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly huggingFaceRepo: string;
  readonly inferenceMode: InferenceMode;
  readonly speedScore: number;
  readonly accuracyScore: number;
  readonly fileSizeBytes: number;
  readonly isMultilingual: boolean;
  /** Whether the model produces output while audio is still being recorded. */
  readonly isRealtime: boolean;
}

/** A model entry combining its definition with runtime state. */
export interface ModelEntry {
  readonly definition: ModelDefinition;
  /** Whether the model files are fully cached in the browser. */
  readonly isDownloaded: boolean;
  /** Whether this is the currently selected inference backend. */
  readonly isActive: boolean;
  /**
   * Download progress as a 0–1 fraction.
   * `null` when no download is in progress.
   */
  readonly downloadProgress: number | null;
}
