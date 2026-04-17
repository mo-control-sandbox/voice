import { MODEL_CACHE_PARTITION } from './ModelCacheKey';
import type { ModelDefinition } from '../types/models';
import type { ModelFileStore } from './ModelFileStore';

const HF_BASE_URL = 'https://huggingface.co';

/** Shape of the Hugging Face model metadata API response. */
interface HfModelMetadata {
  readonly siblings: readonly { readonly rfilename: string }[];
}

/**
 * ModelFileStore implementation that downloads and caches Whisper model files
 * using the browser Cache API, sourced from Hugging Face.
 *
 * The cache partition name is shared with TransformersJsWorker via
 * MODEL_CACHE_PARTITION so that inference reads files placed here without
 * re-fetching them.
 */
export class RendererModelCache implements ModelFileStore {
  private readonly modelToRepo: ReadonlyMap<string, string>;

  /**
   * @param models - The Whisper model definitions from the catalog.
   *   Used to resolve canonical model IDs to their Hugging Face repository paths.
   */
  constructor(models: readonly ModelDefinition[]) {
    this.modelToRepo = new Map(models.map((m) => [m.id, m.huggingFaceRepo]));
  }

  /**
   * Checks whether the model's sentinel file (`config.json`) is present in the
   * cache, indicating a completed download.
   */
  async isDownloaded(modelId: string): Promise<boolean> {
    const repo = this.requireRepo(modelId);
    const cache = await caches.open(MODEL_CACHE_PARTITION);
    const sentinelUrl = this.buildFileUrl(repo, 'config.json');
    const match = await cache.match(sentinelUrl);
    return match !== undefined;
  }

  /**
   * Downloads all files for the given model from Hugging Face and stores them
   * in the browser cache. Reports fractional progress by file count.
   * Cleans up partial entries if any file fetch fails.
   */
  async download(modelId: string, onProgress: (fraction: number) => void): Promise<void> {
    const repo = this.requireRepo(modelId);
    const metadataUrl = `${HF_BASE_URL}/api/models/${repo}`;
    const metadataResponse = await fetch(metadataUrl);
    if (!metadataResponse.ok) {
      throw new Error(
        `Failed to fetch model metadata for ${repo}: ${metadataResponse.statusText}`,
      );
    }

    const metadata = (await metadataResponse.json()) as HfModelMetadata;
    const filenames = metadata.siblings.map((s) => s.rfilename);
    const total = filenames.length;
    const cache = await caches.open(MODEL_CACHE_PARTITION);
    const downloadedUrls: string[] = [];

    try {
      let completed = 0;
      for (const filename of filenames) {
        const fileUrl = this.buildFileUrl(repo, filename);
        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${fileUrl}: ${response.statusText}`);
        }
        await cache.put(fileUrl, response);
        downloadedUrls.push(fileUrl);
        completed++;
        onProgress(completed / total);
      }
    } catch (error) {
      // Clean up any partially downloaded files before rethrowing.
      await Promise.all(downloadedUrls.map((url) => cache.delete(url)));
      throw error;
    }
  }

  /**
   * Removes all cached entries belonging to the given model,
   * identified by their Hugging Face URL prefix.
   */
  async delete(modelId: string): Promise<void> {
    const repo = this.requireRepo(modelId);
    const cache = await caches.open(MODEL_CACHE_PARTITION);
    const repoPrefix = `${HF_BASE_URL}/${repo}/`;
    const keys = await cache.keys();
    await Promise.all(
      keys
        .filter((req) => req.url.startsWith(repoPrefix))
        .map((req) => cache.delete(req)),
    );
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private requireRepo(modelId: string): string {
    const repo = this.modelToRepo.get(modelId);
    if (repo === undefined) {
      throw new Error(`RendererModelCache: unknown model id "${modelId}"`);
    }
    return repo;
  }

  private buildFileUrl(huggingFaceRepo: string, filename: string): string {
    return `${HF_BASE_URL}/${huggingFaceRepo}/resolve/main/${filename}`;
  }
}
