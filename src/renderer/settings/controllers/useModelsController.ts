import { useCallback, useEffect, useRef, useState } from 'react';
import type { ModelEntry } from '../../types/models';
import { getRendererModelRepository } from '../../services/getRendererModelRepository';
import { reportModelReadiness } from '../../services/ModelReadinessReporter';
import { notifyModelActivated } from '../../services/notifyModelActivated';

const POLL_INTERVAL_MS = 500;

const repository = getRendererModelRepository();

function hasActiveDownload(models: readonly ModelEntry[]): boolean {
  return models.some((model) => model.downloadProgress !== null);
}

/**
 * Owns model management use-cases for the Models settings page.
 */
export function useModelsController(): {
  readonly models: ModelEntry[];
  readonly downloadErrors: ReadonlyMap<string, string>;
  readonly handleDownload: (id: string) => Promise<void>;
  readonly handleDelete: (id: string) => Promise<void>;
  readonly handleSetActive: (id: string) => Promise<void>;
} {
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [downloadErrors, setDownloadErrors] = useState<ReadonlyMap<string, string>>(new Map());
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshModels = useCallback(async (): Promise<void> => {
    const latestModels = await repository.getModels();
    setModels(latestModels);
    void reportModelReadiness(latestModels);
  }, []);

  useEffect(() => {
    void refreshModels();
  }, [refreshModels]);

  useEffect(() => {
    if (hasActiveDownload(models)) {
      pollingRef.current ??= setInterval(() => {
        void refreshModels();
      }, POLL_INTERVAL_MS);
    } else if (pollingRef.current !== null) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    return () => {
      if (pollingRef.current !== null) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [models, refreshModels]);

  async function handleDownload(id: string): Promise<void> {
    setDownloadErrors((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });

    void (async () => {
      try {
        await repository.download(id, () => {
          // Progress is polled by the interval.
        });
      } catch (err: unknown) {
        console.error('[ModelsPage] Download failed:', err);
        setDownloadErrors((prev) => (
          new Map(prev).set(id, 'Download failed. Check your connection and try again.')
        ));
      } finally {
        await refreshModels();
      }
    })();

    await refreshModels();
  }

  async function handleDelete(id: string): Promise<void> {
    await repository.delete(id);
    await refreshModels();
  }

  async function handleSetActive(id: string): Promise<void> {
    await repository.setActiveModel(id);
    notifyModelActivated();
    await refreshModels();
  }

  return {
    models,
    downloadErrors,
    handleDownload,
    handleDelete,
    handleSetActive,
  };
}
