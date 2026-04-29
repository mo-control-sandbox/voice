import { Download, X } from 'lucide-react';
import type { ModelEntry } from '../../types/models';
import { formatModelSize } from './formatModelSize';

interface ModelSelectionStepProps {
  readonly models: readonly ModelEntry[];
  readonly downloadingModelId: string | null;
  readonly downloadErrors: ReadonlyMap<string, string>;
  readonly onDownload: (id: string) => Promise<void>;
  readonly onDelete: (id: string) => Promise<void>;
}

/**
 * Displays model options and download controls for the onboarding model step.
 */
export function ModelSelectionStep(props: ModelSelectionStepProps): React.JSX.Element {
  const {
    models,
    downloadingModelId,
    downloadErrors,
    onDownload,
    onDelete,
  } = props;

  return (
    <section className="welcome-stage">
      <h2 className="welcome-stage__title">Choose a model for MoVoice to download</h2>
      <p className="welcome-stage__description">
        You can change it later in Settings.
      </p>
      <div className="welcome-stage__body welcome-stage__body--static">
        <div className="welcome-model-list">
          {models.map((model) => (
            <article
              key={model.definition.id}
              className="welcome-model-tile welcome-no-drag"
              data-disabled={downloadingModelId !== null && downloadingModelId !== model.definition.id ? 'true' : undefined}
              data-downloaded={model.isDownloaded ? 'true' : undefined}
            >
              <div className="welcome-model-tile__info">
                <h3 className="welcome-model-card__name">{model.definition.label}</h3>
                <p className="welcome-model-tile__description">{model.definition.description}</p>
                <div className="welcome-model-tile__tags">
                  <span className="welcome-model-tile__tag">
                    {model.definition.isMultilingual ? 'Polyglot' : 'English'}
                  </span>
                  {model.definition.isRealtime && (
                    <span className="welcome-model-tile__tag">
                      Real-time
                    </span>
                  )}
                </div>
              </div>
              <div className="welcome-model-tile__statusbar">
                <span className="welcome-model-tile__size">{formatModelSize(model.definition.fileSizeBytes)}</span>
                <span className="welcome-model-tile__tools">
                  {model.downloadProgress !== null && (
                    <>
                      <span
                        className="welcome-model-tile__progress"
                        style={{ background: `conic-gradient(var(--primary) ${String(Math.round(model.downloadProgress * 100))}%, color-mix(in oklch, var(--muted) 70%, var(--background)) 0)` }}
                        aria-label={`Downloading ${String(Math.round(model.downloadProgress * 100))}%`}
                      />
                      <button
                        type="button"
                        className="welcome-model-tile__icon-btn welcome-model-tile__icon-btn--danger welcome-no-drag"
                        onClick={() => { void onDelete(model.definition.id); }}
                        aria-label={`Cancel download of ${model.definition.label}`}
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    </>
                  )}
                  {model.downloadProgress === null && !model.isDownloaded && (
                    <button
                      type="button"
                      className="welcome-model-tile__icon-btn welcome-no-drag"
                      disabled={downloadingModelId !== null}
                      onClick={() => {
                        void onDownload(model.definition.id);
                      }}
                      aria-label={`Download ${model.definition.label}`}
                    >
                      <Download size={14} aria-hidden="true" />
                    </button>
                  )}
                  {model.downloadProgress === null && model.isDownloaded && (
                    <button
                      type="button"
                      className="welcome-model-tile__icon-btn welcome-model-tile__icon-btn--danger welcome-no-drag"
                      disabled={downloadingModelId !== null}
                      onClick={() => {
                        void onDelete(model.definition.id);
                      }}
                      aria-label={`Cancel ${model.definition.label}`}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  )}
                </span>
              </div>
            </article>
          ))}
        </div>
        <div className="welcome-model-actions">
          {downloadErrors.size > 0 && (
            <p className="welcome-model-card__error">{downloadErrors.values().next().value}</p>
          )}
        </div>
      </div>
    </section>
  );
}
