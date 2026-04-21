import { useState, useEffect, useRef, useCallback } from 'react';
import type { ModelDefinition, ModelEntry } from '../../types/models';
import { RendererModelCatalog } from '../../services/RendererModelCatalog';
import { RendererModelCache } from '../../services/RendererModelCache';
import { RendererModelStateStore } from '../../services/RendererModelStateStore';
import { RendererModelRepository } from '../../services/RendererModelRepository';
import { ModelCard } from '../components/ModelCard';
import '../components/Switch.css';
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

/** Models settings page — view, download, delete, and activate Whisper models. */
export function ModelsPage(): React.JSX.Element {

  const [models, setModels] = useState<ModelEntry[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshModels = useCallback(async (): Promise<void> => {
    setModels(await repository.getModels());
  }, [repository]);

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

  const builtinEntry = models.find((m) => m.definition.isBuiltin);
  const whisperModels = models.filter((m) => !m.definition.isBuiltin);
  const isBuiltinActive = builtinEntry?.isActive ?? false;
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
    void repository.download(id, () => { /* progress is polled */ });
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
        <h2 className="models-page__heading">Models</h2>
        <p className="models-page__description">
          Choose the speech recognition engine used for transcription.
        </p>
      </div>

      {/* Built-in macOS Speech toggle */}
      <div className="builtin-toggle">
        <div className="builtin-toggle__text">
          <span className="builtin-toggle__name">Use built-in macOS Speech Recognition</span>
          <span className="builtin-toggle__hint">
            No download required. Uses Apple's on-device recogniser.
          </span>
        </div>
        <button
          role="switch"
          aria-checked={isBuiltinActive}
          aria-label="Use built-in macOS Speech Recognition"
          className="switch"
          disabled={!isBuiltinActive && !hasDownloadedWhisper}
          onClick={() => { void handleToggleBuiltin(!isBuiltinActive); }}
        >
          <span className="switch__thumb" />
        </button>
      </div>

      {/* Whisper model list */}
      <div className="models-page__list">
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
