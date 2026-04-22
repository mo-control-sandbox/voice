import { useState, useEffect, useRef, useCallback } from 'react';
import type { ModelDefinition, ModelEntry } from '../../types/models';
import { RendererModelCatalog } from '../../services/RendererModelCatalog';
import { RendererModelCache } from '../../services/RendererModelCache';
import { RendererModelStateStore } from '../../services/RendererModelStateStore';
import { RendererModelRepository } from '../../services/RendererModelRepository';
import { ModelCard } from '../components/ModelCard';
import { Switch } from '../components/Switch';
import './ModelsPage.css';

const POLL_INTERVAL_MS = 500;

const _catalog = new RendererModelCatalog();
const repository = new RendererModelRepository(
  _catalog,
  new RendererModelCache(_catalog.getDefinitions().filter((d): d is ModelDefinition => !d.isBuiltin)),
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
    setModels(await repository.getModels());
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

  const builtinEntry        = models.find((m) => m.definition.isBuiltin);
  const whisperModels       = models.filter((m) => !m.definition.isBuiltin);
  const isBuiltinActive     = builtinEntry?.isActive ?? false;
  const hasDownloadedWhisper = whisperModels.some((m) => m.isDownloaded);

  async function handleToggleBuiltin(checked: boolean): Promise<void> {
    if (checked) {
      await repository.setActiveModel('builtin');
    } else {
      const first = whisperModels.find((m) => m.isDownloaded);
      if (first !== undefined) await repository.setActiveModel(first.definition.id);
    }
    await refreshModels();
  }

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

      {/* Built-in macOS toggle */}
      <div className="builtin-toggle">
        <div className="builtin-toggle__text">
          <span className="builtin-toggle__name">Built-in macOS Speech Recognition</span>
          <span className="builtin-toggle__hint">No download required. English only.</span>
        </div>
        <Switch
          checked={isBuiltinActive}
          disabled={!isBuiltinActive && !hasDownloadedWhisper}
          onChange={(v) => { void handleToggleBuiltin(v); }}
        />
      </div>

      {/* Whisper model list */}
      <div className="models-page__list">
        {whisperModels.map((model) => (
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
