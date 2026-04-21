import type { ModelEntry, ModelDefinition } from '../../types/models';

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

/** Converts a 0-1 fraction to a percentage string. */
function toPercent(fraction: number): string {
  return `${String(Math.round(fraction * 100))}%`;
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
    <div>
      <span>{definition.label}</span>
      {state === 'active' && <span> [In Use]</span>}
      <span> {definition.isMultilingual ? 'Multilingual' : 'English'}</span>
      <span> {formatMb(definition.fileSizeBytes)}</span>
      <p>{definition.description}</p>
      <p>Speed: {definition.speedScore} / Accuracy: {definition.accuracyScore}</p>

      {model.downloadProgress !== null && (
        <p>Downloading: {toPercent(model.downloadProgress)}</p>
      )}

      {model.downloadProgress === null && (
        <span>
          {state === 'available' && <button onClick={onDownload}>Download</button>}
          {state === 'downloaded' && (
            <>
              <button onClick={onDelete}>Delete</button>
              <button onClick={onSetActive}>Use</button>
            </>
          )}
          {state === 'active' && (
            <>
              <button onClick={onDelete}>Delete</button>
              <button disabled>Active</button>
            </>
          )}
        </span>
      )}
    </div>
  );
}
