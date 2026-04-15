import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { desktop } from '@mobrowser/api';
import type { ModelSpec, InferenceBackend } from '../../shared/types';

/** Fraction downloaded (0–1) reported during an active model download. */
export type ProgressCallback = (fraction: number) => void

/** Fired when the active model changes (either switched or deleted). */
export type ModelChangeCallback<TSpec extends ModelSpec> = (
  model: (TSpec & ModelRuntimeState) | null,
) => void

/** Runtime state fields added to a catalog entry for UI consumption. */
export interface ModelRuntimeState {
  readonly isDownloaded: boolean
  readonly isActive: boolean
  /** `null` when no download is in progress for this model. */
  readonly downloadProgress: number | null
}

/**
 * Generic facade for local AI model lifecycle management.
 * Owns catalog enumeration, download lifecycle, active-model selection,
 * storage-path persistence, and inference delegation.
 */
export class LocalModelService<TSpec extends ModelSpec, TInput, TOutput> {
  private readonly catalog: readonly TSpec[];
  private readonly backend: InferenceBackend<TInput, TOutput>;
  private readonly getStoragePathValue: () => string;
  private readonly setStoragePathValue: (path: string) => void;
  private readonly getActiveModelIdValue: () => string;
  private readonly setActiveModelIdValue: (modelId: string) => void;
  private readonly downloadedIds = new Set<string>();
  private readonly downloadProgress = new Map<string, number>();
  private readonly activeDownloadControllers = new Map<string, AbortController>();
  private readonly changeListeners: ModelChangeCallback<TSpec>[] = [];

  constructor(
    catalog: TSpec[],
    backend: InferenceBackend<TInput, TOutput>,
    getStoragePath: () => string,
    setStoragePath: (path: string) => void,
    getActiveModelId: () => string,
    setActiveModelId: (modelId: string) => void,
  ) {
    this.catalog = catalog;
    this.backend = backend;
    this.getStoragePathValue = getStoragePath;
    this.setStoragePathValue = setStoragePath;
    this.getActiveModelIdValue = getActiveModelId;
    this.setActiveModelIdValue = setActiveModelId;
  }

  /**
   * Scans storage against the catalog to determine which models are downloaded,
   * then enforces the active-model invariant.
   */
  initialize(): void {
    const previousModelId = this.getSelectedModelId();
    this.scanStorage();
    const selectionChanged = this.reconcileSelectedModel();
    if (selectionChanged || previousModelId !== this.getSelectedModelId()) {
      this.fireChangeListeners();
    }
  }

  /** Loads the active model into the backend eagerly. */
  async warmUp(): Promise<void> {
    const activeModelId = this.getActiveLocalModelId();
    if (activeModelId !== null) {
      await this.backend.load(activeModelId, this.getStoragePath());
    }
  }

  /** Returns all catalog entries enriched with runtime state. */
  getModels(): (TSpec & ModelRuntimeState)[] {
    const activeModelId = this.getSelectedModelId();
    return this.catalog.map((spec) => ({
      ...spec,
      isDownloaded: this.downloadedIds.has(spec.id),
      isActive: spec.id === activeModelId,
      downloadProgress: this.downloadProgress.get(spec.id) ?? null,
    }));
  }

  /** Returns the active model entry, or `null` if none is selected. */
  getActiveModel(): (TSpec & ModelRuntimeState) | null {
    const activeModelId = this.getActiveLocalModelId();
    if (activeModelId === null) return null;
    const spec = this.catalog.find((s) => s.id === activeModelId);
    if (spec === undefined) return null;
    return {
      ...spec,
      isDownloaded: this.downloadedIds.has(spec.id),
      isActive: true,
      downloadProgress: this.downloadProgress.get(spec.id) ?? null,
    };
  }

  /** Returns the persisted model selection, including the synthetic `builtin` entry. */
  getSelectedModelId(): string {
    return this.getActiveModelIdValue();
  }

  /** Hot-swaps the active model and loads it into the backend. */
  async setActiveModel(modelId: string): Promise<void> {
    if (modelId === 'builtin') {
      if (this.backend.isLoaded) {
        this.backend.unload();
      }
      this.setActiveModelIdValue('builtin');
      this.fireChangeListeners();
      return;
    }

    const spec = this.catalog.find((s) => s.id === modelId);
    if (spec === undefined) {
      throw new Error(`Unknown model: ${modelId}`);
    }
    if (!this.downloadedIds.has(modelId)) {
      throw new Error(`Model is not downloaded: ${modelId}`);
    }

    if (this.backend.isLoaded) {
      this.backend.unload();
    }
    await this.backend.load(modelId, this.getStoragePath());
    this.setActiveModelIdValue(modelId);
    this.fireChangeListeners();
  }

  /**
   * Downloads a model from HuggingFace Hub into `storagePath`.
   * Reports progress via `onProgress`. Cleans up partial files on failure.
   */
  async downloadModel(modelId: string, onProgress: ProgressCallback): Promise<void> {
    const spec = this.catalog.find((s) => s.id === modelId);
    if (spec === undefined) throw new Error(`Unknown model: ${modelId}`);

    const controller = new AbortController();
    this.activeDownloadControllers.set(modelId, controller);
    this.downloadProgress.set(modelId, 0);

    try {
      await this.fetchModelFiles(spec, (fraction) => {
        this.downloadProgress.set(modelId, fraction);
        onProgress(fraction);
      }, controller.signal);
      this.downloadedIds.add(modelId);
    } catch (err) {
      // Partial download cleanup: remove any files that may have been written.
      this.removeModelFiles(modelId);
      throw err;
    } finally {
      this.downloadProgress.delete(modelId);
      this.activeDownloadControllers.delete(modelId);
    }
  }

  /** Aborts an in-flight download, if any. */
  cancelDownload(modelId: string): void {
    this.activeDownloadControllers.get(modelId)?.abort();
  }

  /**
   * Unloads the model from the backend if active, removes files from disk,
   * and re-enforces the active-model invariant.
   */
  deleteModel(modelId: string): Promise<void> {
    if (this.activeDownloadControllers.has(modelId)) {
      throw new Error('Cannot delete a model while it is downloading');
    }
    if (this.getActiveLocalModelId() === modelId && this.backend.isLoaded) {
      this.backend.unload();
    }
    this.removeModelFiles(modelId);
    this.downloadedIds.delete(modelId);

    const previousSelection = this.getSelectedModelId();
    const selectionChanged = this.reconcileSelectedModel();
    if (selectionChanged || previousSelection === modelId) {
      this.fireChangeListeners();
    }
    return Promise.resolve();
  }

  /** Returns the current model storage directory path. */
  getStoragePath(): string {
    return this.getStoragePathValue();
  }

  /**
   * Updates the model storage path, re-scans, and enforces the invariant.
   * Refuses if any download is in progress.
   */
  updateStoragePath(path: string): Promise<void> {
    if (this.activeDownloadControllers.size > 0) {
      throw new Error('Cannot change storage path while a download is in progress');
    }
    const previousSelection = this.getSelectedModelId();
    const shouldReloadActiveLocalModel = previousSelection !== 'builtin' && this.backend.isLoaded;

    if (shouldReloadActiveLocalModel) {
      this.backend.unload();
    }

    this.setStoragePathValue(path);
    this.scanStorage();
    const selectionChanged = this.reconcileSelectedModel();
    const nextSelection = this.getSelectedModelId();

    if (nextSelection !== 'builtin' && this.downloadedIds.has(nextSelection)) {
      return this.backend.load(nextSelection, this.getStoragePath())
        .then(() => {
          if (selectionChanged || previousSelection !== nextSelection || shouldReloadActiveLocalModel) {
            this.fireChangeListeners();
          }
        });
    }

    if (selectionChanged || previousSelection !== nextSelection || shouldReloadActiveLocalModel) {
      this.fireChangeListeners();
    }
    return Promise.resolve();
  }

  /** Delegates inference to the backend. */
  run(input: TInput): Promise<TOutput> {
    return this.backend.run(input);
  }

  /** Opens the model's directory in Finder. */
  revealInFinder(modelId: string): void {
    desktop.showPath(join(this.getStoragePath(), modelId));
  }

  /** Registers a listener that fires whenever the active model changes. */
  onActiveModelChanged(callback: ModelChangeCallback<TSpec>): void {
    this.changeListeners.push(callback);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private scanStorage(): void {
    this.downloadedIds.clear();
    for (const spec of this.catalog) {
      if (existsSync(join(this.getStoragePath(), spec.id))) {
        this.downloadedIds.add(spec.id);
      }
    }
  }

  /**
   * Ensures the persisted active-model selection still points to a usable entry.
   * Falls back to the first downloaded local model, or `builtin` if none exist.
   */
  private reconcileSelectedModel(): boolean {
    const currentSelection = this.getSelectedModelId();
    if (currentSelection === 'builtin') {
      return false;
    }
    if (this.downloadedIds.has(currentSelection)) {
      return false;
    }

    const fallbackModelId = this.catalog.find((s) => this.downloadedIds.has(s.id))?.id ?? 'builtin';
    if (fallbackModelId === currentSelection) {
      return false;
    }

    this.setActiveModelIdValue(fallbackModelId);
    return true;
  }

  private getActiveLocalModelId(): string | null {
    const activeModelId = this.getSelectedModelId();
    return activeModelId === 'builtin' ? null : activeModelId;
  }

  private removeModelFiles(modelId: string): void {
    const modelDir = join(this.getStoragePath(), modelId);
    if (existsSync(modelDir)) {
      rmSync(modelDir, { recursive: true, force: true });
    }
  }

  private async fetchModelFiles(
    spec: TSpec,
    onProgress: ProgressCallback,
    signal: AbortSignal,
  ): Promise<void> {
    // Access the HuggingFace repo ID from the spec if available; fall back to spec.id.
    const huggingFaceRepo = (spec as unknown as { huggingFaceRepo?: string }).huggingFaceRepo;
    const repoId = huggingFaceRepo ?? spec.id;

    // Fetch file list from the HuggingFace API.
    const indexResponse = await fetch(
      `https://huggingface.co/api/models/${repoId}`,
      { signal },
    );
    if (!indexResponse.ok) {
      throw new Error(`Failed to fetch model index: ${indexResponse.statusText}`);
    }
    const meta = await indexResponse.json() as { siblings?: { rfilename: string }[] };
    const files = meta.siblings?.map((s) => s.rfilename) ?? ['config.json'];

    const modelDir = join(this.getStoragePath(), spec.id);
    mkdirSync(modelDir, { recursive: true });

    // Report progress as files completed (byte-level tracking requires streaming).
    const totalFiles = files.length;
    let completedFiles = 0;

    for (const filename of files) {
      const fileUrl = `https://huggingface.co/${repoId}/resolve/main/${filename}`;
      const dest = join(modelDir, filename);

      mkdirSync(dirname(dest), { recursive: true });

      const fileResponse = await fetch(fileUrl, { signal });
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch ${filename}: ${fileResponse.statusText}`);
      }

      const data = await fileResponse.arrayBuffer();
      await writeFile(dest, Buffer.from(data));

      completedFiles++;
      onProgress(completedFiles / totalFiles);
    }
  }

  private fireChangeListeners(): void {
    const active = this.getActiveModel();
    for (const listener of this.changeListeners) {
      listener(active);
    }
  }
}
