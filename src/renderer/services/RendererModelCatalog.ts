import catalog from '../../../resources/models.json';
import type { AnyModelDefinition, BuiltinModelDefinition, InferenceMode, ModelDefinition } from '../types/models';

/** Shape of each entry in the bundled models.json catalog. */
interface CatalogEntry {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly huggingFaceRepo: string;
  readonly inferenceMode: InferenceMode;
  readonly speedScore: number;
  readonly accuracyScore: number;
  readonly fileSizeBytes: number;
  readonly isMultilingual: boolean;
}

const BUILTIN_DEFINITION: BuiltinModelDefinition = {
  id: 'builtin',
  label: 'Built-in Speech Recognition',
  description: 'Uses the macOS built-in speech recogniser. No download required.',
  isBuiltin: true,
};

/**
 * Provides the full list of model definitions available to the application,
 * combining the bundled JSON catalog with the synthetic built-in entry.
 */
export class RendererModelCatalog {
  /**
   * Returns all model definitions with the built-in entry prepended.
   * JSON catalog entries lacking `isBuiltin` are treated as Whisper models.
   */
  getDefinitions(): AnyModelDefinition[] {
    const whisperModels: ModelDefinition[] = (catalog as CatalogEntry[]).map(
      (entry) => ({
        id: entry.id,
        label: entry.label,
        description: entry.description,
        huggingFaceRepo: entry.huggingFaceRepo,
        inferenceMode: entry.inferenceMode,
        speedScore: entry.speedScore,
        accuracyScore: entry.accuracyScore,
        fileSizeBytes: entry.fileSizeBytes,
        isMultilingual: entry.isMultilingual,
        isBuiltin: false,
      }),
    );

    return [BUILTIN_DEFINITION, ...whisperModels];
  }
}
