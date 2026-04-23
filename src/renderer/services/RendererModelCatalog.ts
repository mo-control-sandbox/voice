import catalog from '../../../resources/models.json';
import type { InferenceMode, ModelDefinition } from '../types/models';

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

/**
 * Provides the full list of model definitions available to the application
 * from the bundled JSON catalog.
 */
export class RendererModelCatalog {
  /**
   * Returns all model definitions from the bundled JSON catalog.
   */
  getDefinitions(): ModelDefinition[] {
    return (catalog as CatalogEntry[]).map((entry) => ({
      id: entry.id,
      label: entry.label,
      description: entry.description,
      huggingFaceRepo: entry.huggingFaceRepo,
      inferenceMode: entry.inferenceMode,
      speedScore: entry.speedScore,
      accuracyScore: entry.accuracyScore,
      fileSizeBytes: entry.fileSizeBytes,
      isMultilingual: entry.isMultilingual,
    }));
  }
}
