import {
  env,
  pipeline,
  VoxtralRealtimeForConditionalGeneration,
  VoxtralRealtimeProcessor,
  type ProgressInfo,
} from '@huggingface/transformers';
import type { ModelDefinition } from '../types/models';
import type { ModelFileStore } from './ModelFileStore';

const OPFS_DIR = 'hf-models';
const MARKER_FILENAME = '.cache-complete';

/**
 * Model storage backed by the Origin Private File System.
 *
 * Serves two roles: it implements ModelFileStore for the explicit download
 * phase (Settings UI), and it satisfies the Transformers.js custom cache
 * interface so inference workers can read stored files without re-fetching.
 * Files are stored under hf-models/{org}/{model}/{filename}, mirroring the
 * Hugging Face URL structure. A per-model .cache-complete marker signals a
 * finished download to isDownloaded().
 *
 * Workers that only need cache read-through may construct this with no args.
 * App code that drives downloads must pass the model catalog.
 */
export class OPFSModelCache implements ModelFileStore {
  private readonly modelToDefinition: ReadonlyMap<string, ModelDefinition>;

  constructor(models: readonly ModelDefinition[] = []) {
    this.modelToDefinition = new Map(models.map((m) => [m.id, m]));
  }

  // ── Transformers.js custom cache interface ────────────────────────────────────

  /**
   * Returns the cached file as a Response, or undefined on a cache miss.
   */
  async match(url: string): Promise<Response | undefined> {
    try {
      const root = await this.getRoot();
      const parts = this.urlToParts(url);
      let dir = root;
      for (let i = 0; i < parts.length - 1; i++) {
        dir = await dir.getDirectoryHandle(parts[i]);
      }
      const fileHandle = await dir.getFileHandle(parts[parts.length - 1]);
      const file = await fileHandle.getFile();
      return new Response(file.stream(), {
        status: 200,
        headers: { 'Content-Length': String(file.size) },
      });
    } catch {
      return undefined;
    }
  }

  /**
   * Streams the response body into OPFS at the path derived from the URL.
   * Calls the progress callback with byte-level updates so Transformers.js
   * can aggregate them into progress_total events.
   */
  async put(
    url: string,
    response: Response,
    progressCallback?: (data: { progress: number; loaded: number; total: number }) => void,
  ): Promise<void> {
    const root = await this.getRoot();
    const parts = this.urlToParts(url);
    let dir = root;
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i], { create: true });
    }
    const fileHandle = await dir.getFileHandle(parts[parts.length - 1], { create: true });
    const writable = await fileHandle.createWritable();
    const total = Number(response.headers.get('content-length')) || 0;
    const reportProgress = progressCallback ?? ((_data) => { return; });
    let loaded = 0;
    if (response.body === null) {
      throw new Error(`OPFSModelCache.put: response body is missing for "${url}"`);
    }
    const reader = response.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        await writable.write(value);
        loaded += value.byteLength;
        if (total > 0) {
          reportProgress({ progress: (loaded / total) * 100, loaded, total });
        }
      }
      await writable.close();
    } catch (err) {
      await writable.abort();
      throw err;
    }
  }

  // ── ModelFileStore ────────────────────────────────────────────────────────────

  /**
   * Returns true when the per-model completion marker is present in OPFS.
   */
  async isDownloaded(modelId: string): Promise<boolean> {
    const definition = this.modelToDefinition.get(modelId);
    if (definition === undefined) return false;
    try {
      const root = await this.getRoot();
      const modelDir = await this.getModelDir(root, definition.huggingFaceRepo);
      await modelDir.getFileHandle(MARKER_FILENAME);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Downloads all files required for the given model by delegating to
   * Transformers.js from_pretrained, using this cache as the store so only
   * the files matching the configured dtype are fetched. Progress is reported
   * on a [0, 1] scale via the progress_total aggregate events fired by
   * Transformers.js. Disposes the loaded model immediately after caching.
   * Cleans up the model directory and rethrows on failure.
   */
  async download(modelId: string, onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<void> {
    const definition = this.requireDefinition(modelId);
    const repo = definition.huggingFaceRepo;

    env.useBrowserCache = false;
    env.useCustomCache = true;
    env.customCache = this;

    const progressCallback = (info: ProgressInfo): void => {
      if (info.status === 'progress_total') {
        onProgress(info.progress / 100);
      }
    };

    // Transformers.js can fail to propagate certain internal errors (e.g.
    // RangeError from oversized allocations) through the pipeline() promise,
    // firing them as unhandled rejections instead. We intercept those here by
    // racing the actual load against the window's unhandledrejection event so
    // they are treated as first-class download failures.
    //
    // We also create an internal AbortController so that when an unhandled
    // rejection fires we can signal the pipeline to stop, preventing it from
    // continuing to run as a background ghost after we have already failed.
    const internalController = new AbortController();
    signal?.addEventListener('abort', () => { internalController.abort(signal.reason); });
    const effectiveSignal = internalController.signal;

    let unhandledRejectionListener: ((event: PromiseRejectionEvent) => void) | null = null;
    const unhandledRejection = new Promise<never>((_, reject) => {
      unhandledRejectionListener = (event: PromiseRejectionEvent): void => {
        event.preventDefault();
        internalController.abort(event.reason);
        reject(event.reason as unknown);
      };
      window.addEventListener('unhandledrejection', unhandledRejectionListener);
    });

    const loadModel = async (): Promise<void> => {
      if (definition.inferenceMode === 'whisper') {
        const pipe = await pipeline('automatic-speech-recognition', repo, {
          dtype: { encoder_model: 'q4', decoder_model_merged: 'q4' },
          progress_callback: progressCallback,
          signal: effectiveSignal,
        });
        await pipe.dispose();
      } else if (definition.inferenceMode === 'voxtral-realtime') {
        const model = await VoxtralRealtimeForConditionalGeneration.from_pretrained(repo, {
          dtype: { audio_encoder: 'q4f16', embed_tokens: 'q4f16', decoder_model_merged: 'q4f16' },
          device: 'webgpu',
          progress_callback: progressCallback,
          signal: effectiveSignal,
        }) as VoxtralRealtimeForConditionalGeneration;
        await VoxtralRealtimeProcessor.from_pretrained(repo, { signal: effectiveSignal });
        await model.dispose();
      } else {
        const pipe = await pipeline('automatic-speech-recognition', repo, {
          dtype: 'q4',
          device: 'webgpu',
          progress_callback: progressCallback,
          signal: effectiveSignal,
        });
        await pipe.dispose();
      }
      await this.writeMarker(repo);
    };

    try {
      await Promise.race([loadModel(), unhandledRejection]);
    } catch (error) {
      await this.removeModelDir(repo);
      throw error;
    } finally {
      if (unhandledRejectionListener !== null) {
        window.removeEventListener('unhandledrejection', unhandledRejectionListener);
      }
    }
  }

  /**
   * Removes all OPFS files for the given model, including the completion marker.
   */
  async remove(modelId: string): Promise<void> {
    const definition = this.modelToDefinition.get(modelId);
    if (definition === undefined) return;
    await this.removeModelDir(definition.huggingFaceRepo);
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  private async getRoot(): Promise<FileSystemDirectoryHandle> {
    const root = await navigator.storage.getDirectory();
    return root.getDirectoryHandle(OPFS_DIR, { create: true });
  }

  private async getModelDir(
    root: FileSystemDirectoryHandle,
    repo: string,
    create = false,
  ): Promise<FileSystemDirectoryHandle> {
    let dir = root;
    for (const part of repo.split('/')) {
      dir = await dir.getDirectoryHandle(part, { create });
    }
    return dir;
  }

  private async writeMarker(repo: string): Promise<void> {
    const root = await this.getRoot();
    const modelDir = await this.getModelDir(root, repo, true);
    const markerHandle = await modelDir.getFileHandle(MARKER_FILENAME, { create: true });
    const w = await markerHandle.createWritable();
    await w.write('1');
    await w.close();
  }

  private async removeModelDir(repo: string): Promise<void> {
    try {
      const root = await this.getRoot();
      const parts = repo.split('/');
      let dir = root;
      for (let i = 0; i < parts.length - 1; i++) {
        dir = await dir.getDirectoryHandle(parts[i]);
      }
      await dir.removeEntry(parts[parts.length - 1], { recursive: true });
    } catch { /* ignore if already absent */ }
  }

  private urlToParts(url: string): string[] {
    try {
      const parts = new URL(url).pathname.split('/').filter(Boolean);
      const resolveIdx = parts.indexOf('resolve');
      if (resolveIdx >= 0) parts.splice(resolveIdx, 2);
      return parts;
    } catch {
      return [encodeURIComponent(url)];
    }
  }

  private requireDefinition(modelId: string): ModelDefinition {
    const definition = this.modelToDefinition.get(modelId);
    if (definition === undefined) {
      throw new Error(`OPFSModelCache: unknown model id "${modelId}"`);
    }
    return definition;
  }
}
