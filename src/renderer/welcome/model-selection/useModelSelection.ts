import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ModelEntry } from '../../types/models';
import { getRendererModelRepository } from '../../services/getRendererModelRepository';
import { reportModelReadiness } from '../../services/ModelReadinessReporter';

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
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    void reportModelReadiness(latestModels);
  }, []);

  useEffect(() => {
    const hasActiveDownload = models.some((model) => model.downloadProgress !== null);
    if (hasActiveDownload) {
      pollingRef.current ??= setInterval(() => {
        void refreshModels();
      }, MODEL_POLL_INTERVAL_MS);
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

  async function handleModelDownload(id: string): Promise<void> {
    if (downloadingModelId !== null && downloadingModelId !== id) return;
    setDownloadErrors(new Map());

    void (async () => {
      try {
        await modelRepository.download(id, () => {
          // Model progress updates through polling.
        });
        await modelRepository.setActiveModel(id);
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
