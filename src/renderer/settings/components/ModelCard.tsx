import type { ModelEntry, ModelDefinition } from '../../types/models';
import './ModelCard.css';

interface ModelCardProps {
  readonly model: ModelEntry;
  readonly onDownload: () => void;
  readonly onDelete: () => void;
  readonly onSetActive: () => void;
}

/** Formats a byte count as a human-readable megabyte string. */
function formatMb(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(0)} MB`;
}

/** Converts a 0–1 fraction to a CSS percentage string. */
function toPercent(fraction: number): string {
  return `${String(Math.round(fraction * 100))}%`;
}

interface ScorePipsProps {
  readonly label: string;
  readonly score: number;
  readonly maxScore?: number;
}

/** Five filled/unfilled dots representing a 1–5 score. */
function ScorePips({ label, score, maxScore = 5 }: ScorePipsProps): React.JSX.Element {
  return (
    <div className="score-pips">
      <span className="score-pips__label">{label}</span>
      <div className="score-pips__dots" aria-label={`${label}: ${score} out of ${maxScore}`}>
        {Array.from({ length: maxScore }, (_, i) => (
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

type ModelState = 'available' | 'downloading' | 'downloaded' | 'active';

function resolveModelState(model: ModelEntry): ModelState {
  if (model.isActive) return 'active';
  if (model.downloadProgress !== null) return 'downloading';
  if (model.isDownloaded) return 'downloaded';
  return 'available';
}

/**
 * Displays a single Whisper model with its metadata, download state,
 * and action controls (download, activate, delete).
 */
export function ModelCard({ model, onDownload, onDelete, onSetActive }: ModelCardProps): React.JSX.Element {
  const definition = model.definition as ModelDefinition;
  const state = resolveModelState(model);

  return (
    <div className="model-card" data-model-state={state}>
      {/* Header */}
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

      {/* Score pips */}
      <div className="model-card__scores">
        <ScorePips label="Speed" score={definition.speedScore} />
        <ScorePips label="Accuracy" score={definition.accuracyScore} />
      </div>

      {/* Download progress */}
      {model.downloadProgress !== null && (
        <div className="model-card__progress">
          <div className="model-card__progress-header">
            <span className="model-card__progress-label">Downloading…</span>
            <span className="model-card__progress-pct">{toPercent(model.downloadProgress)}</span>
          </div>
          <div
            className="model-card__progress-track"
            role="progressbar"
            aria-valuenow={Math.round(model.downloadProgress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Downloading ${definition.label}`}
          >
            <div
              className="model-card__progress-fill"
              style={{ width: toPercent(model.downloadProgress) }}
            />
          </div>
        </div>
      )}

      {/* Actions — hidden while downloading */}
      {model.downloadProgress === null && (
        <div className="model-card__actions">
          {state === 'available' && (
            <button className="model-card__btn" data-btn="primary" onClick={onDownload}>
              Download
            </button>
          )}
          {state === 'downloaded' && (
            <>
              <button className="model-card__btn" data-btn="destructive" onClick={onDelete}>
                Delete
              </button>
              <button className="model-card__btn" data-btn="primary" onClick={onSetActive}>
                Use
              </button>
            </>
          )}
          {state === 'active' && (
            <>
              <button className="model-card__btn" data-btn="destructive" onClick={onDelete}>
                Delete
              </button>
              <button className="model-card__btn" data-btn="ghost" disabled>
                Active
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
