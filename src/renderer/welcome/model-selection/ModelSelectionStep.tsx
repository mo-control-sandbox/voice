import { Loader2, X } from 'lucide-react';
import type { ModelEntry } from '../../types/models';
import { formatModelSize } from './formatModelSize';

interface ModelSelectionStepProps {
  readonly models: readonly ModelEntry[];
  readonly downloadingModelId: string | null;
  readonly warmingUpModelId: string | null;
  readonly downloadErrors: ReadonlyMap<string, string>;
  readonly onDownload: (id: string) => Promise<void>;
  readonly onDelete: (id: string) => Promise<void>;
}

function ScorePips(props: { readonly score: number; readonly label: string }): React.JSX.Element {
  const { score, label } = props;

  return (
    <div className="welcome-score-pips">
      <span className="welcome-score-pips__label">{label}</span>
      <div className="welcome-score-pips__dots">
        {Array.from({ length: 5 }, (_, index) => (
          <span
            key={index}
            className="welcome-score-pips__dot"
            data-filled={index < Math.round(score) ? 'true' : undefined}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Displays model options and download controls for the onboarding model step.
 */
export function ModelSelectionStep(props: ModelSelectionStepProps): React.JSX.Element {
  const {
    models,
    downloadingModelId,
    warmingUpModelId,
    downloadErrors,
    onDownload,
    onDelete,
  } = props;

  return (
    <section className="welcome-stage">
      <div className="welcome-stage__title-section">
        <h2 className="welcome-stage__title">Download a model for MoVoice</h2>
        <p className="welcome-stage__description">You can change it later in Settings.</p>
      </div>
      <div className="welcome-stage__body welcome-stage__body--static">
        <div className="welcome-model-list">
          {models.map((model) => (
            <article
              key={model.definition.id}
              className="welcome-model-tile welcome-no-drag"
              data-disabled={(downloadingModelId !== null && downloadingModelId !== model.definition.id) || (warmingUpModelId !== null && warmingUpModelId !== model.definition.id) ? 'true' : undefined}
              data-downloaded={model.isDownloaded ? 'true' : undefined}
            >
              <div className="welcome-model-tile__info">
                <h3 className="welcome-model-card__name">{model.definition.label}</h3>
                <p className="welcome-model-tile__description">{model.definition.description}</p>
                <div className="welcome-model-tile__scores">
                  <ScorePips score={model.definition.speedScore} label="Speed" />
                  <ScorePips score={model.definition.accuracyScore} label="Accuracy" />
                </div>
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
                  {model.downloadProgress !== null && model.downloadProgress < 1 && (
                    <>
                      <span
                        className="welcome-model-tile__progress-pct"
                        aria-label={`Downloading ${String(Math.round(model.downloadProgress * 100))}%`}
                      >
                        {Math.round(model.downloadProgress * 100)}%
                      </span>
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
                  {((model.downloadProgress !== null && model.downloadProgress >= 1) || warmingUpModelId === model.definition.id) && (
                    <>
                      <span className="welcome-model-tile__preparing-label">Preparing...</span>
                      <Loader2
                        size={14}
                        className="welcome-model-tile__warmup-spinner"
                        aria-hidden="true"
                      />
                    </>
                  )}
                  {model.downloadProgress === null && warmingUpModelId !== model.definition.id && !model.isDownloaded && (
                    <button
                      type="button"
                      className="welcome-model-tile__download-btn welcome-no-drag"
                      disabled={downloadingModelId !== null}
                      onClick={() => {
                        void onDownload(model.definition.id);
                      }}
                      aria-label={`Download ${model.definition.label}`}
                    >
                      Download
                    </button>
                  )}
                  {model.downloadProgress === null && warmingUpModelId !== model.definition.id && model.isDownloaded && (
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
