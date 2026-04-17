import type { ModelEntry } from '../types/models';
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
   * The built-in entry is always marked as downloaded.
   */
  async getModels(): Promise<ModelEntry[]> {
    const definitions = this.catalog.getDefinitions();
    const activeId = this.stateStore.getActiveModelId();

    return Promise.all(
      definitions.map(async (definition): Promise<ModelEntry> => {
        if (definition.isBuiltin) {
          return {
            definition,
            isDownloaded: true,
            isActive: activeId === 'builtin',
            downloadProgress: this.downloadProgress.get('builtin') ?? null,
          };
        }

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
   * Returns the currently active model entry.
   * Falls back to the built-in entry if the stored ID is not found.
   * The catalog always has at least one entry (builtin), so models is non-empty.
   */
  async getActiveModel(): Promise<ModelEntry> {
    const models = await this.getModels();
    const activeId = this.stateStore.getActiveModelId();
    const found = models.find((m) => m.definition.id === activeId);
    if (found !== undefined) {
      return found;
    }
    // models is always non-empty because the catalog always contains the built-in entry.
    // Array index access without noUncheckedIndexedAccess returns T (not T | undefined),
    // so we fall back to the first element safely.
    return models[0];
  }

  /**
   * Sets the active model. Whisper models must be fully downloaded before
   * they can be selected; the built-in entry can always be set as active.
   */
  async setActiveModel(id: string): Promise<void> {
    if (id === 'builtin') {
      this.stateStore.setActiveModelId('builtin');
      return;
    }

    const definitions = this.catalog.getDefinitions();
    const definition = definitions.find((d) => d.id === id);
    if (definition === undefined || definition.isBuiltin) {
      throw new Error(`Unknown model id: ${id}`);
    }

    const isDownloaded = await this.fileStore.isDownloaded(id);
    if (!isDownloaded) {
      throw new Error(
        `Cannot activate model "${id}" because it has not been downloaded.`,
      );
    }

    this.stateStore.setActiveModelId(id);
  }

  /**
   * Downloads the model with the given ID and reports fractional progress.
   * After a successful first-time download, auto-selects the model if the
   * current active model is still the built-in.
   */
  async download(
    id: string,
    onProgress: (fraction: number) => void,
  ): Promise<void> {
    const definitions = this.catalog.getDefinitions();
    const definition = definitions.find((d) => d.id === id);
    if (definition === undefined || definition.isBuiltin) {
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

    // Auto-select on first download: if user has not yet chosen a Whisper model.
    if (this.stateStore.getActiveModelId() === 'builtin') {
      this.stateStore.setActiveModelId(id);
    }
  }

  /**
   * Deletes the cached model files. If the model being deleted is currently
   * active, switches to another downloaded Whisper model or the built-in.
   */
  async delete(id: string): Promise<void> {
    const definitions = this.catalog.getDefinitions();
    const definition = definitions.find((d) => d.id === id);
    if (definition === undefined || definition.isBuiltin) {
      throw new Error(`Cannot delete model with id: ${id}`);
    }

    const isActive = this.stateStore.getActiveModelId() === id;

    if (isActive) {
      // Find another downloaded Whisper model to fall back to, or use builtin.
      const allModels = await this.getModels();
      const fallback = allModels.find(
        (m) => m.isDownloaded && m.definition.id !== id,
      );
      this.stateStore.setActiveModelId(fallback?.definition.id ?? 'builtin');
    }

    await this.fileStore.delete(id);
  }

  /**
   * Returns the stored preferred transcription language code.
   */
  getLanguage(): string {
    return this.stateStore.getLanguage();
  }

  /**
   * Stores the given language code as the preferred transcription language.
   */
  setLanguage(language: string): void {
    this.stateStore.setLanguage(language);
  }
}
