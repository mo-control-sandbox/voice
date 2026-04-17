/** A Whisper-compatible model from the bundled catalog. */
export interface ModelDefinition {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly huggingFaceRepo: string;
  readonly speedScore: number;
  readonly accuracyScore: number;
  readonly fileSizeBytes: number;
  readonly isMultilingual: boolean;
  readonly isBuiltin: false;
}

/** Synthetic entry representing the macOS built-in speech recogniser. */
export interface BuiltinModelDefinition {
  readonly id: 'builtin';
  readonly label: string;
  readonly description: string;
  readonly isBuiltin: true;
}

/** Union of all model definition types. */
export type AnyModelDefinition = ModelDefinition | BuiltinModelDefinition;

/** A model entry combining its definition with runtime state. */
export interface ModelEntry {
  readonly definition: AnyModelDefinition;
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
