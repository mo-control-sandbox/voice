import { useState, useEffect, useRef, useCallback } from 'react';
import type { ModelEntry } from '../../types/models';
import { RendererModelCatalog } from '../../services/RendererModelCatalog';
import { OPFSModelCache } from '../../services/OPFSModelCache';
import { RendererModelStateStore } from '../../services/RendererModelStateStore';
import { RendererModelRepository } from '../../services/RendererModelRepository';
import { reportModelReadiness } from '../../services/ModelReadinessReporter';
import { ModelCard } from '../components/ModelCard';
import './ModelsPage.css';

const POLL_INTERVAL_MS = 500;

const _catalog = new RendererModelCatalog();
const repository = new RendererModelRepository(
  _catalog,
  new OPFSModelCache(_catalog.getDefinitions()),
  new RendererModelStateStore(),
);

function hasActiveDownload(models: ModelEntry[]): boolean {
  return models.some((m) => m.downloadProgress !== null);
}

/** Models settings page -- view, download, delete, and activate Whisper models. */
export function ModelsPage(): React.JSX.Element {
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [downloadErrors, setDownloadErrors] = useState<ReadonlyMap<string, string>>(new Map());
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshModels = useCallback(async (): Promise<void> => {
    const models = await repository.getModels();
    setModels(models);
    void reportModelReadiness(models);
  }, []);

  useEffect(() => { void refreshModels(); }, [refreshModels]);

  useEffect(() => {
    if (hasActiveDownload(models)) {
      pollingRef.current ??= setInterval(() => { void refreshModels(); }, POLL_INTERVAL_MS);
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

  async function handleDownload(id: string): Promise<void> {
    setDownloadErrors((prev) => { const m = new Map(prev); m.delete(id); return m; });
    void repository
      .download(id, () => { /* progress polled by interval */ })
      .catch((err: unknown) => {
        console.error('[ModelsPage] Download failed:', err);
        setDownloadErrors((prev) =>
          new Map(prev).set(id, 'Download failed. Check your connection and try again.'),
        );
        void refreshModels();
      });
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
    <div className="models-page">
      <div className="models-page__header">
        <h1 className="models-page__heading">Models</h1>
        <p className="models-page__description">
          Choose the speech recognition engine for your recordings.
        </p>
      </div>

      <div className="models-page__list">
        {models.map((model) => (
          <ModelCard
            key={model.definition.id}
            model={model}
            error={downloadErrors.get(model.definition.id) ?? null}
            onDownload={() => { void handleDownload(model.definition.id); }}
            onDelete={() => { void handleDelete(model.definition.id); }}
            onSetActive={() => { void handleSetActive(model.definition.id); }}
          />
        ))}
      </div>
    </div>
  );
}
