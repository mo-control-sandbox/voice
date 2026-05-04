import { useCallback, useEffect, useState } from 'react';
import type { ModelEntry } from '../../types/models';
import { getRendererModelRepository } from '../../models/application/getRendererModelRepository';
import { notifyModelActivated } from '../../models/application/notifyModelActivated';
import { useModelDownloadPolling } from '../../models/application/useModelDownloadPolling';

const POLL_INTERVAL_MS = 500;

const repository = getRendererModelRepository();

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

  const refreshModels = useCallback(async (): Promise<void> => {
    const latestModels = await repository.getModels();
    setModels(latestModels);
  }, []);

  useEffect(() => {
    void refreshModels();
  }, [refreshModels]);

  useModelDownloadPolling(models, refreshModels, POLL_INTERVAL_MS);

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
