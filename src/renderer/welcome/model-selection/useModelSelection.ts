import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ModelEntry } from '../../types/models';
import { getRendererModelRepository } from '../../models/application/getRendererModelRepository';
import { notifyModelActivated } from '../../models/application/notifyModelActivated';
import { useModelDownloadPolling } from '../../models/application/useModelDownloadPolling';

const MODEL_POLL_INTERVAL_MS = 500;

const modelRepository = getRendererModelRepository();

/**
 * Owns model selection state and operations for onboarding.
 */
export function useModelSelection(): {
  readonly models: readonly ModelEntry[];
  readonly downloadErrors: ReadonlyMap<string, string>;
  readonly downloadingModelId: string | null;
  readonly warmingUpModelId: string | null;
  readonly hasReadyActiveModel: boolean;
  readonly refreshModels: () => Promise<void>;
  readonly handleModelDownload: (id: string) => Promise<void>;
  readonly handleModelCancel: (id: string) => Promise<void>;
} {
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [downloadErrors, setDownloadErrors] = useState<ReadonlyMap<string, string>>(new Map());

  const hasReadyActiveModel = useMemo(
    () => models.some((model) => (
      model.isActive &&
      model.isDownloaded &&
      model.downloadProgress === null
    )),
    [models],
  );

  const downloadingModelId = useMemo(
    () => models.find((model) => model.downloadProgress !== null)?.definition.id ?? null,
    [models],
  );

  const refreshModels = useCallback(async (): Promise<void> => {
    const latestModels = await modelRepository.getModels();
    setModels(latestModels);
  }, []);

  useEffect(() => {
    void refreshModels();
  }, [refreshModels]);

  useModelDownloadPolling(models, refreshModels, MODEL_POLL_INTERVAL_MS);

  async function handleModelDownload(id: string): Promise<void> {
    if (downloadingModelId !== null && downloadingModelId !== id) return;
    setDownloadErrors(new Map());

    void (async () => {
      try {
        await modelRepository.download(id, () => {
          // Model progress updates through polling.
        });
        await modelRepository.setActiveModel(id);
        notifyModelActivated();
        await refreshModels();
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error('[WelcomeApp] Model download failed:', error);
        setDownloadErrors((prev) => new Map(prev).set(id, 'Download failed. Try again.'));
      } finally {
        await refreshModels();
      }
    })();

    await refreshModels();
  }

  async function handleModelCancel(id: string): Promise<void> {
    if (downloadingModelId === id) {
      modelRepository.cancelDownload(id);
      await refreshModels();
      return;
    }
    if (downloadingModelId !== null) return;
    await modelRepository.delete(id);
    await refreshModels();
  }

  return {
    models,
    downloadErrors,
    downloadingModelId,
    warmingUpModelId: null,
    hasReadyActiveModel,
    refreshModels,
    handleModelDownload,
    handleModelCancel,
  };
}
