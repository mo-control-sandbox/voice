import type { ModelDefinition, ModelEntry } from '../types/models';
import type { RendererModelCatalog } from './RendererModelCatalog';
import type { ModelFileStore } from './ModelFileStore';
import type { ModelStateStore } from './ModelStateStore';

/**
 * Composes the catalog, file store, and state store into a unified facade for
 * model management. All model selection rules and download side-effects are
 * enforced here, keeping UI components free of business logic.
 */
export class RendererModelRepository {
  /** In-progress download progress per model ID (0–1 fraction). */
  private readonly downloadProgress = new Map<string, number>();

  constructor(
    private readonly catalog: RendererModelCatalog,
    private readonly fileStore: ModelFileStore,
    private readonly stateStore: ModelStateStore,
  ) {}

  /**
   * Returns all model entries with up-to-date runtime state.
   */
  async getModels(): Promise<ModelEntry[]> {
    const definitions = this.catalog.getDefinitions();
    const activeId = await this.stateStore.getActiveModelId();

    return Promise.all(
      definitions.map(async (definition): Promise<ModelEntry> => {
        const isDownloaded = await this.fileStore.isDownloaded(definition.id);
        return {
          definition,
          isDownloaded,
          isActive: activeId === definition.id,
          downloadProgress: this.downloadProgress.get(definition.id) ?? null,
        };
      }),
    );
  }

  /**
   * Returns the currently active model entry, or the first catalog entry if
   * no valid selection is stored.
   */
  async getActiveModel(): Promise<ModelEntry> {
    const models = await this.getModels();
    const activeId = await this.stateStore.getActiveModelId();
    const found = models.find((m) => m.definition.id === activeId);
    if (found !== undefined) {
      return found;
    }
    return models[0];
  }

  /**
   * Sets the active model. The model must be fully downloaded before
   * it can be selected.
   */
  async setActiveModel(id: string): Promise<void> {
    const definitions = this.catalog.getDefinitions();
    const definition = definitions.find((d) => d.id === id);
    if (definition === undefined) {
      throw new Error(`Unknown model id: ${id}`);
    }

    const isDownloaded = await this.fileStore.isDownloaded(id);
    if (!isDownloaded) {
      throw new Error(
        `Cannot activate model "${id}" because it has not been downloaded.`,
      );
    }

    await this.stateStore.setActiveModelId(id);
  }

  /**
   * Downloads the model with the given ID and reports fractional progress.
   * Auto-selects the model after a successful download if no downloaded
   * model is currently active.
   */
  async download(
    id: string,
    onProgress: (fraction: number) => void,
  ): Promise<void> {
    const definitions = this.catalog.getDefinitions();
    const definition: ModelDefinition | undefined = definitions.find((d) => d.id === id);
    if (definition === undefined) {
      throw new Error(`Cannot download model with id: ${id}`);
    }

    this.downloadProgress.set(id, 0);

    try {
      await this.fileStore.download(id, (fraction) => {
        this.downloadProgress.set(id, fraction);
        onProgress(fraction);
      });
    } finally {
      this.downloadProgress.delete(id);
    }

    // Auto-select after download if no downloaded model is currently active.
    const currentActiveId = await this.stateStore.getActiveModelId();
    const isCurrentActiveDownloaded =
      currentActiveId !== '' && (await this.fileStore.isDownloaded(currentActiveId));
    if (!isCurrentActiveDownloaded) {
      await this.stateStore.setActiveModelId(id);
    }
  }

  /**
   * Deletes the cached model files. If the model being deleted is currently
   * active, switches to another downloaded model or clears the selection.
   */
  async delete(id: string): Promise<void> {
    const definitions = this.catalog.getDefinitions();
    const definition = definitions.find((d) => d.id === id);
    if (definition === undefined) {
      throw new Error(`Cannot delete model with id: ${id}`);
    }

    const isActive = (await this.stateStore.getActiveModelId()) === id;

    if (isActive) {
      const allModels = await this.getModels();
      const fallback = allModels.find(
        (m) => m.isDownloaded && m.definition.id !== id,
      );
      await this.stateStore.setActiveModelId(fallback?.definition.id ?? '');
    }

    await this.fileStore.remove(id);
  }

  /**
   * Returns the stored preferred transcription language code.
   */
  async getLanguage(): Promise<string> {
    return this.stateStore.getLanguage();
  }

  /**
   * Stores the given language code as the preferred transcription language.
   */
  async setLanguage(language: string): Promise<void> {
    await this.stateStore.setLanguage(language);
  }
}
