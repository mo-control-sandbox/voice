import type { ModelEntry, ModelDefinition } from '../../types/models';
import './ModelCard.css';

interface ModelCardProps {
  readonly model: ModelEntry;
  /** Non-null when the most recent download attempt failed. */
  readonly error: string | null;
  readonly onDownload: () => void;
  readonly onDelete: () => void;
  readonly onSetActive: () => void;
}

type ModelState = 'available' | 'downloading' | 'downloaded' | 'active' | 'error';

function resolveModelState(model: ModelEntry, hasError: boolean): ModelState {
  if (hasError)                          return 'error';
  if (model.isActive)                    return 'active';
  if (model.downloadProgress !== null)   return 'downloading';
  if (model.isDownloaded)                return 'downloaded';
  return 'available';
}

/** Formats a byte count as a human-readable megabyte string. */
function formatMb(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(0)} MB`;
}

/** Converts a 0-1 fraction to a rounded percentage string. */
function toPercent(fraction: number): string {
  return `${String(Math.round(fraction * 100))}%`;
}

/**
 * Displays a single Whisper model with its metadata, download state,
 * and action controls (download, activate, delete).
 */
export function ModelCard({ model, error, onDownload, onDelete, onSetActive }: ModelCardProps): React.JSX.Element {
  const definition = model.definition as ModelDefinition;
  const state      = resolveModelState(model, error !== null);

  // Five-dot pip row -- filled dots represent the score out of 5.
  function ScorePips({ score, label }: { score: number; label: string }): React.JSX.Element {
    return (
      <div className="score-pips">
        <span className="score-pips__label">{label}</span>
        <div className="score-pips__dots">
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={i}
              className="score-pips__dot"
              data-filled={i < Math.round(score) ? 'true' : undefined}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="model-card" data-model-state={state}>
      {/* Header: name + badges + file size */}
      <div className="model-card__header">
        <div className="model-card__meta">
          <div className="model-card__title-row">
            <span className="model-card__name">{definition.label}</span>
            {state === 'active' && (
              <span className="model-card__badge" data-badge="active">In Use</span>
            )}
            <span
              className="model-card__badge"
              data-badge={definition.isMultilingual ? 'multilingual' : 'en-only'}
            >
              {definition.isMultilingual ? 'Multilingual' : 'English'}
            </span>
          </div>
          <p className="model-card__description">{definition.description}</p>
        </div>
        <span className="model-card__size">{formatMb(definition.fileSizeBytes)}</span>
      </div>

      {/* Speed + accuracy score pips */}
      <div className="model-card__scores">
        <ScorePips score={definition.speedScore}    label="Speed"    />
        <ScorePips score={definition.accuracyScore} label="Accuracy" />
      </div>

      {/* Download progress bar -- only while downloading */}
      {model.downloadProgress !== null && (
        <div className="model-card__progress">
          <div className="model-card__progress-header">
            <span className="model-card__progress-label">Downloading...</span>
            <span className="model-card__progress-pct">{toPercent(model.downloadProgress)}</span>
          </div>
          <div className="model-card__progress-track">
            <div
              className="model-card__progress-fill"
              style={{ width: toPercent(model.downloadProgress) }}
            />
          </div>
        </div>
      )}

      {/* Error notice -- shown after a failed download attempt */}
      {error !== null && (
        <p className="model-card__error">{error}</p>
      )}

      {/* Actions -- hidden while downloading */}
      {model.downloadProgress === null && (
        <div className="model-card__actions">
          {(state === 'available' || state === 'error') && (
            <button type="button" className="model-card__btn" data-btn="primary" onClick={onDownload}>
              {state === 'error' ? 'Retry' : 'Download'}
            </button>
          )}
          {state === 'downloaded' && (
            <>
              <button type="button" className="model-card__btn" data-btn="destructive" onClick={onDelete}>
                Delete
              </button>
              <button type="button" className="model-card__btn" data-btn="primary" onClick={onSetActive}>
                Use
              </button>
            </>
          )}
          {state === 'active' && (
            <button type="button" className="model-card__btn" data-btn="destructive" onClick={onDelete}>
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
