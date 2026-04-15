import type { JSX } from 'react';
import { Download, Trash2, X, CheckCircle2, FolderOpen } from 'lucide-react';
import type { ModelEntryProto } from '@/gen/model';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ModelCardProps {
  readonly model: ModelEntryProto
  readonly onDownload: (modelId: string) => void
  readonly onCancelDownload: (modelId: string) => void
  readonly onDelete: (modelId: string) => void
  readonly onSetActive: (modelId: string) => void
  readonly onRevealInFinder: (modelId: string) => void
}

/** Formats bytes into a human-readable string (e.g. "1.2 GB"). */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '';
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 ** 2);
  return `${mb.toFixed(0)} MB`;
}

/** Renders a labelled score bar with a numeric value. */
function ScoreBar({ label, score }: { label: string; score: number }): JSX.Element {
  const pct = Math.round(score * 10);
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-xs text-muted-foreground w-14 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${String(pct)}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-6 text-right flex-shrink-0">
        {score.toFixed(1)}
      </span>
    </div>
  );
}

/** Displays a single model with its metadata, download state, and actions. */
export function ModelCard({
  model,
  onDownload,
  onCancelDownload,
  onDelete,
  onSetActive,
  onRevealInFinder,
}: ModelCardProps): JSX.Element {
  const isDownloading = model.downloadProgress >= 0 && model.downloadProgress <= 1;
  const progressPct = Math.round(model.downloadProgress * 100);

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-4 transition-colors',
        model.isActive ? 'border-primary/50' : 'border-border',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-foreground">{model.label}</span>
            {model.isActive && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary text-primary-foreground">
                <CheckCircle2 className="w-3 h-3" />
                In Use
              </span>
            )}
            {model.isMultilingual && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
                Multilingual
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{model.description}</p>
          {!model.isBuiltin && (
            <div className="mt-3 space-y-1.5 max-w-xs">
              <ScoreBar label="Speed" score={model.speedScore} />
              <ScoreBar label="Accuracy" score={model.accuracyScore} />
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {!model.isBuiltin && (
            <span className="text-xs text-muted-foreground">{formatBytes(model.fileSizeBytes)}</span>
          )}
          <div className="flex items-center gap-2">
            {!model.isBuiltin && !model.isDownloaded && !isDownloading && (
              <Button size="sm" onClick={() => { onDownload(model.id); }}>
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Download
              </Button>
            )}
            {isDownloading && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { onCancelDownload(model.id); }}
              >
                <X className="w-3.5 h-3.5 mr-1.5" />
                Cancel
              </Button>
            )}
            {model.isDownloaded && !model.isActive && !model.isBuiltin && (
              <>
                <Button variant="ghost" size="sm" onClick={() => { onSetActive(model.id); }}>
                  Use
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { onRevealInFinder(model.id); }}
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { onDelete(model.id); }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
            {model.isActive && !model.isBuiltin && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { onRevealInFinder(model.id); }}
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { onDelete(model.id); }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
            {model.isBuiltin && !model.isActive && (
              <Button variant="ghost" size="sm" onClick={() => { onSetActive(model.id); }}>
                Use
              </Button>
            )}
          </div>
        </div>
      </div>

      {isDownloading && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Downloading…</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${String(progressPct)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
