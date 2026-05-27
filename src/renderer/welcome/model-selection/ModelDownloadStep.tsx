import { AudioLines, CircleCheck, X } from 'lucide-react';
import type { ModelEntry } from '@/types/models.ts';
import { formatModelSize } from './formatModelSize';

interface ModelDownloadStepProps {
  readonly model: ModelEntry | null;
  readonly downloadErrors: ReadonlyMap<string, string>;
  /**
   * Stops the active download for the given model.
   */
  readonly onCancelDownload: (id: string) => Promise<void>;
  readonly onRetry: () => Promise<void>;
}

function clampProgress(progress: number | null, isDownloaded: boolean): number {
  if (isDownloaded) return 1;
  return Math.max(0, Math.min(progress ?? 0, 1));
}

function formatDownloadedSize(bytes: number): string {
  if (bytes >= 1_000_000_000) {
    return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
  }
  return `${String(Math.round(bytes / 1_000_000))} MB`;
}

/**
 * Displays the selected onboarding model while it downloads and becomes active.
 */
export function ModelDownloadStep(props: ModelDownloadStepProps): React.JSX.Element {
  const { model, downloadErrors, onCancelDownload, onRetry } = props;
  const progress = model === null ? 0 : clampProgress(model.downloadProgress, model.isDownloaded);
  const totalBytes = model?.definition.fileSizeBytes ?? 0;
  const downloadedBytes = Math.round(totalBytes * progress);
  const percent = Math.round(progress * 100);
  const error = model === null ? null : (downloadErrors.get(model.definition.id) ?? null);
  const isReady = model !== null
    && model.isDownloaded
    && model.isActive
    && model.downloadProgress === null
    && error === null;
  const detailItems = [
    `${formatDownloadedSize(downloadedBytes)} of ${formatModelSize(totalBytes)}`,
    isReady ? 'Ready to continue' : null,
  ].filter((item): item is string => item !== null);
  const title = model === null
    ? 'Preparing model download'
    : isReady
      ? `${model.definition.label} is ready`
      : `${error === null ? 'Downloading' : 'Could not download'} ${model.definition.label}`;
  const description = isReady
    ? 'Your model is downloaded and ready to use.'
    : 'Please wait while we download and prepare your model.';
  const cancelDownloadModel = typeof model?.downloadProgress === 'number' && !model.isDownloaded
    ? model
    : null;

  return (
    <section className="welcome-stage">
      <div className="welcome-stage__title-section">
        <h2 className="welcome-stage__title">{title}</h2>
        <p className="welcome-stage__description">{description}</p>
      </div>
      <div className="welcome-stage__body welcome-stage__body--download">
        <div className="welcome-status-container">
          {isReady && (
              <div className="welcome-status" data-state="success">
                <CircleCheck size={16} aria-hidden="true" />
                <span>Download complete. Continue to set up permissions.</span>
              </div>
          )}
          {error !== null && (
              <div className="welcome-status" data-state="info">
                <span>{error}</span>
                <button
                    type="button"
                    className="welcome-status-retry-btn welcome-no-drag"
                    onClick={() => {
                      void onRetry();
                    }}
                >
                  Retry
                </button>
              </div>
          )}
        </div>
        <div className="welcome-model-download" data-ready={isReady ? 'true' : undefined}>
          <div className="welcome-model-download__header">
            <span className="welcome-model-download__icon" aria-hidden="true">
              <AudioLines size={28} strokeWidth={2.3} />
            </span>
            <div className="welcome-model-download__meta">
              <h3 className="welcome-model-download__name">
                {model?.definition.label ?? 'Selected model'}
              </h3>
              <p className="welcome-model-download__description">
                {model?.definition.description ?? 'Preparing the selected model.'}
              </p>
            </div>
          </div>

          <div className="welcome-model-download__progress-container">
            <div className="welcome-model-download__progress-row">
              <div
                className="welcome-model-download__progress-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                aria-label={model === null ? 'Model download progress' : `${model.definition.label} download progress`}
              >
                <span
                  className="welcome-model-download__progress-fill"
                  style={{ width: `${String(percent)}%` }}
                />
              </div>
              <div className="welcome-model-download__progress-actions">
                <span className="welcome-model-download__progress-value">{percent}%</span>
                {cancelDownloadModel !== null && (
                  <button
                    type="button"
                    className="welcome-model-download__cancel-btn welcome-no-drag"
                    aria-label={`Cancel ${cancelDownloadModel.definition.label} download`}
                    title="Cancel download"
                    onClick={() => {
                      void onCancelDownload(cancelDownloadModel.definition.id);
                    }}
                  >
                    <X size={15} strokeWidth={2.5} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
            <p className="welcome-model-download__details">{detailItems.join('\u00A0\u00A0•\u00A0\u00A0')}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
