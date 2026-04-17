import type { ModelEntry } from '../../types/models';
import type { ModelDefinition } from '../../types/models';
import { cn } from '../../lib/utils';

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

/** Formats a 0–5 score as a one-decimal string. */
function formatScore(score: number): string {
  return score.toFixed(1);
}

/** Converts a 0–1 fraction to a CSS percentage string for inline styles. */
function toPercent(fraction: number): string {
  return `${String(Math.round(fraction * 100))}%`;
}

interface ScoreBarProps {
  readonly label: string;
  readonly score: number;
  readonly maxScore?: number;
}

/** Renders a labelled score bar with a numeric value. */
function ScoreBar({ label, score, maxScore = 5 }: ScoreBarProps): React.JSX.Element {
  const fraction = Math.min(score / maxScore, 1);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: toPercent(fraction) }}
        />
      </div>
      <span className="w-6 text-right text-muted-foreground">
        {formatScore(score)}
      </span>
    </div>
  );
}

/**
 * Displays a single Whisper model with its metadata, download state,
 * and action controls (download, set active, delete).
 */
export function ModelCard({
  model,
  onDownload,
  onDelete,
  onSetActive,
}: ModelCardProps): React.JSX.Element {
  // ModelCard is only rendered for Whisper (non-builtin) models.
  const definition = model.definition as ModelDefinition;

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-4 flex flex-col gap-3',
        model.isActive && 'border-primary',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{definition.label}</span>
            {model.isActive && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-medium">
                In Use
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {definition.description}
          </p>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {formatMb(definition.fileSizeBytes)}
        </span>
      </div>

      {/* Score bars */}
      <div className="flex flex-col gap-1.5">
        <ScoreBar label="Speed" score={definition.speedScore} />
        <ScoreBar label="Accuracy" score={definition.accuracyScore} />
      </div>

      {/* Download progress — only rendered when a download is actively in progress */}
      {model.downloadProgress !== null && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Downloading…</span>
            <span>{toPercent(model.downloadProgress)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: toPercent(model.downloadProgress) }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      {model.downloadProgress === null && (
        <div className="flex items-center gap-2 justify-end">
          {!model.isDownloaded && (
            <button
              onClick={onDownload}
              className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
            >
              Download
            </button>
          )}
          {model.isDownloaded && (
            <>
              <button
                onClick={onDelete}
                className="text-xs px-3 py-1.5 rounded-md border border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
              >
                Delete
              </button>
              {!model.isActive && (
                <button
                  onClick={onSetActive}
                  className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
                >
                  Use
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
