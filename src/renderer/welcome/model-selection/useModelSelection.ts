import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ModelEntry } from '@/types/models.ts';
import { getRendererModelRepository } from '@/models/application/getRendererModelRepository.ts';
import { notifyModelActivated } from '@/models/application/notifyModelActivated.ts';
import { useModelDownloadPolling } from '@/models/application/useModelDownloadPolling.ts';

const MODEL_POLL_INTERVAL_MS = 500;

const modelRepository = getRendererModelRepository();

/**
 * Owns model selection state and operations for onboarding.
 */
export function useModelSelection(): {
  readonly models: readonly ModelEntry[];
  readonly selectedModel: ModelEntry | null;
  readonly selectedModelId: string;
  readonly downloadErrors: ReadonlyMap<string, string>;
  readonly downloadingModelId: string | null;
  readonly warmingUpModelId: string | null;
  readonly hasReadySelectedModel: boolean;
  readonly hasSelectedModel: boolean;
  readonly refreshModels: () => Promise<void>;
  readonly handleModelDownload: (id: string) => Promise<void>;
  readonly handleModelCancel: (id: string) => Promise<void>;
  readonly handleModelSelection: (id: string) => void;
  readonly handleSelectedModelContinue: () => Promise<void>;
} {
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [downloadErrors, setDownloadErrors] = useState<ReadonlyMap<string, string>>(new Map());

  const selectedModel = useMemo(
    () => models.find((model) => model.definition.id === selectedModelId) ?? null,
    [models, selectedModelId],
  );

  const hasReadySelectedModel = useMemo(
    () => selectedModel !== null
      && selectedModel.isActive
      && selectedModel.isDownloaded
      && selectedModel.downloadProgress === null,
    [selectedModel],
  );

  const downloadingModelId = useMemo(
    () => models.find((model) => model.downloadProgress !== null)?.definition.id ?? null,
    [models],
  );

  const refreshModels = useCallback(async (): Promise<void> => {
    const latestModels = await modelRepository.getModels();
    setModels(latestModels);
    setSelectedModelId((current) => {
      if (latestModels.some((model) => model.definition.id === current)) return current;
      const activeModel = latestModels.find((model) => model.isActive);
      if (activeModel !== undefined) return activeModel.definition.id;
      return latestModels.length > 0 ? latestModels[0].definition.id : '';
    });
  }, []);

  useEffect(() => {
    void refreshModels();
  }, [refreshModels]);

  useModelDownloadPolling(models, refreshModels, MODEL_POLL_INTERVAL_MS);

  const handleModelDownload = useCallback(async (id: string): Promise<void> => {
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
  }, [downloadingModelId, refreshModels]);

  const handleModelCancel = useCallback(async (id: string): Promise<void> => {
    if (downloadingModelId === id) {
      modelRepository.cancelDownload(id);
      await refreshModels();
      return;
    }
    if (downloadingModelId !== null) return;
    await modelRepository.delete(id);
    await refreshModels();
  }, [downloadingModelId, refreshModels]);

  const handleModelSelection = useCallback((id: string): void => {
    if (downloadingModelId !== null) return;
    setSelectedModelId(id);
  }, [downloadingModelId]);

  const handleSelectedModelContinue = useCallback(async (): Promise<void> => {
    if (selectedModel === null) return;
    const id = selectedModel.definition.id;

    if (!selectedModel.isDownloaded) {
      await handleModelDownload(id);
      return;
    }

    setDownloadErrors(new Map());
    try {
      await modelRepository.setActiveModel(id);
      notifyModelActivated();
      await refreshModels();
    } catch (error: unknown) {
      console.error('[WelcomeApp] Model activation failed:', error);
      setDownloadErrors((prev) => new Map(prev).set(id, 'Could not activate this model. Try again.'));
    }
  }, [handleModelDownload, refreshModels, selectedModel]);

  return {
    models,
    selectedModel,
    selectedModelId,
    downloadErrors,
    downloadingModelId,
    warmingUpModelId: null,
    hasReadySelectedModel,
    hasSelectedModel: selectedModel !== null,
    refreshModels,
    handleModelDownload,
    handleModelCancel,
    handleModelSelection,
    handleSelectedModelContinue,
  };
}
