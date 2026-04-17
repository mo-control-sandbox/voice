import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { ModelDefinition, ModelEntry } from '../../types/models';
import { RendererModelCatalog } from '../../services/RendererModelCatalog';
import { RendererModelCache } from '../../services/RendererModelCache';
import { RendererModelStateStore } from '../../services/RendererModelStateStore';
import { RendererModelRepository } from '../../services/RendererModelRepository';
import { ModelCard } from '../components/ModelCard';

const POLL_INTERVAL_MS = 500;

/** Returns true if any model currently has an active download. */
function hasActiveDownload(models: ModelEntry[]): boolean {
  return models.some((m) => m.downloadProgress !== null);
}

/**
 * The Models settings page. Allows the user to view, download, delete,
 * and activate Whisper models, and to toggle the built-in macOS recogniser.
 */
export function ModelsPage(): React.JSX.Element {
  const repository = useMemo(() => {
    const catalog = new RendererModelCatalog();
    const whisperDefs = catalog.getDefinitions().filter(
      (d): d is ModelDefinition => !d.isBuiltin,
    );
    return new RendererModelRepository(
      catalog,
      new RendererModelCache(whisperDefs),
      new RendererModelStateStore(),
    );
  }, []);

  const [models, setModels] = useState<ModelEntry[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshModels = useCallback(async (): Promise<void> => {
    const updated = await repository.getModels();
    setModels(updated);
  }, [repository]);

  // Load models on mount.
  useEffect(() => {
    void refreshModels();
  }, [refreshModels]);

  // Poll at 2 fps while any download is in progress.
  useEffect(() => {
    if (hasActiveDownload(models)) {
      pollingRef.current ??= setInterval(() => {
        void refreshModels();
      }, POLL_INTERVAL_MS);
    } else {
      if (pollingRef.current !== null) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }

    return () => {
      if (pollingRef.current !== null) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [models, refreshModels]);

  const builtinEntry = models.find((m) => m.definition.isBuiltin);
  const whisperModels = models.filter((m) => !m.definition.isBuiltin);
  const isBuiltinActive = builtinEntry?.isActive ?? false;
  const hasDownloadedWhisper = whisperModels.some((m) => m.isDownloaded);

  async function handleToggleBuiltin(checked: boolean): Promise<void> {
    if (checked) {
      await repository.setActiveModel('builtin');
    } else {
      const firstDownloaded = whisperModels.find((m) => m.isDownloaded);
      if (firstDownloaded !== undefined) {
        await repository.setActiveModel(firstDownloaded.definition.id);
      }
    }
    await refreshModels();
  }

  async function handleDownload(id: string): Promise<void> {
    // Start download without awaiting; the polling loop picks up progress.
    void repository.download(id, () => {
      // Progress is reflected via the repository's internal state, read back on each poll.
    });
    // Immediately refresh to show the initial progress state.
    await refreshModels();
  }

  async function handleDelete(id: string): Promise<void> {
    await repository.delete(id);
    await refreshModels();
  }

  async function handleSetActive(id: string): Promise<void> {
    await repository.setActiveModel(id);
    await refreshModels();
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Models</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Choose the speech recognition engine used for transcription.
        </p>
      </div>

      {/* Built-in toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
        <div>
          <p className="text-sm font-medium">
            Use built-in macOS Speech Recognition
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            No download required. Uses Apple&rsquo;s on-device recogniser.
          </p>
        </div>
        <input
          type="checkbox"
          checked={isBuiltinActive}
          disabled={!isBuiltinActive && !hasDownloadedWhisper}
          onChange={(e) => { void handleToggleBuiltin(e.target.checked); }}
          className="h-4 w-4 accent-primary cursor-pointer disabled:cursor-not-allowed"
          aria-label="Use built-in macOS Speech Recognition"
        />
      </div>

      {/* Whisper model list */}
      <div className="flex flex-col gap-3">
        {whisperModels.map((model) => (
          <ModelCard
            key={model.definition.id}
            model={model}
            onDownload={() => { void handleDownload(model.definition.id); }}
            onDelete={() => { void handleDelete(model.definition.id); }}
            onSetActive={() => { void handleSetActive(model.definition.id); }}
          />
        ))}
      </div>
    </div>
  );
}
