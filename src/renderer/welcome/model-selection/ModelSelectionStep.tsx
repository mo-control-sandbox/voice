import type { ModelEntry } from '@/types/models.ts';
import { formatModelSize } from './formatModelSize';

interface ModelSelectionStepProps {
  readonly models: readonly ModelEntry[];
  readonly selectedModelId: string;
  readonly downloadingModelId: string | null;
  readonly warmingUpModelId: string | null;
  readonly downloadErrors: ReadonlyMap<string, string>;
  readonly onSelectModel: (id: string) => void;
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
 * Displays selectable model options for the onboarding model step.
 */
export function ModelSelectionStep(props: ModelSelectionStepProps): React.JSX.Element {
  const {
    models,
    selectedModelId,
    downloadingModelId,
    warmingUpModelId,
    downloadErrors,
    onSelectModel,
  } = props;

  return (
    <section className="welcome-stage">
      <div className="welcome-stage__title-section">
        <h2 className="welcome-stage__title">Choose a model for MōVoice</h2>
        <p className="welcome-stage__description">You can change it later in Settings.</p>
      </div>
      <div className="welcome-stage__body welcome-stage__body--static">
        <div className="welcome-model-list" role="radiogroup" aria-label="Model">
          {models.map((model) => {
            const modelId = model.definition.id;
            const isSelected = selectedModelId === modelId;
            const isDisabled = (downloadingModelId !== null && downloadingModelId !== modelId)
              || (warmingUpModelId !== null && warmingUpModelId !== modelId);

            return (
              <article
                key={modelId}
                className="welcome-model-tile welcome-no-drag"
                data-disabled={isDisabled ? 'true' : undefined}
                data-downloaded={model.isDownloaded ? 'true' : undefined}
                data-selected={isSelected ? 'true' : undefined}
                onClick={() => {
                  if (!isDisabled) onSelectModel(modelId);
                }}
              >
                <span className="welcome-model-radio">
                  <input
                    type="radio"
                    className="welcome-model-radio__input welcome-no-drag"
                    name="welcome-model"
                    value={modelId}
                    checked={isSelected}
                    disabled={isDisabled}
                    onChange={() => {
                      onSelectModel(modelId);
                    }}
                    aria-label={`Select ${model.definition.label}`}
                  />
                </span>
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
                    {model.isDownloaded && (
                      <span className="welcome-model-tile__tag" data-state="ready">
                        Ready
                      </span>
                    )}
                  </div>
                </div>
                <div className="welcome-model-tile__statusbar">
                  <span className="welcome-model-tile__size">{formatModelSize(model.definition.fileSizeBytes)}</span>
                </div>
              </article>
            );
          })}
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
