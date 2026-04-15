import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import type { ModelEntryProto } from '@/gen/model';
import { ipc } from '@/gen/ipc';
import { Button } from '@/components/ui/button';
import { ModelCard } from './ModelCard';

/** Progress polling rate in milliseconds (~2 fps). */
const PROGRESS_POLL_MS = 500;

interface ModelsPageProps {
  readonly models: ModelEntryProto[]
  readonly storagePath: string
  readonly onChanged: () => void
}

/**
 * Lists all available Whisper models and the built-in macOS speech
 * recognition option with download/delete/activate actions.
 */
export function ModelsPage({ models: initialModels, storagePath: initialPath, onChanged }: ModelsPageProps): JSX.Element {
  const [models, setModels] = useState<ModelEntryProto[]>(initialModels);
  const [storagePath, setStoragePath] = useState(initialPath);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync with parent when props change (after a refetch).
  useEffect(() => {
    setModels(initialModels);
    setStoragePath(initialPath);
  }, [initialModels, initialPath]);

  // Poll GetModels at 2 fps while any model is downloading.
  useEffect(() => {
    const hasActiveDownload = models.some((m) => m.downloadProgress >= 0 && m.downloadProgress <= 1);

    if (hasActiveDownload && pollRef.current === null) {
      pollRef.current = setInterval(() => {
        ipc.model.GetModels({})
          .then((response) => {
            setModels(response.models);
            const stillDownloading = response.models.some(
              (m) => m.downloadProgress >= 0 && m.downloadProgress <= 1,
            );
            if (!stillDownloading && pollRef.current !== null) {
              clearInterval(pollRef.current);
              pollRef.current = null;
              onChanged();
            }
          })
          .catch((err: unknown) => { console.error('[ModelsPage] Poll error:', err); });
      }, PROGRESS_POLL_MS);
    } else if (!hasActiveDownload && pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    return () => {
      if (pollRef.current !== null) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [models, onChanged]);

  const handleDownload = (modelId: string): void => {
    ipc.model.DownloadModel({ modelId })
      .then(() => {
        // Trigger progress polling by refreshing model list.
        return ipc.model.GetModels({});
      })
      .then((response) => { setModels(response.models); })
      .catch((err: unknown) => { console.error('[ModelsPage] Download error:', err); });
  };

  const handleCancelDownload = (modelId: string): void => {
    void ipc.model.CancelDownload({ modelId });
  };

  const handleDelete = (modelId: string): void => {
    ipc.model.DeleteModel({ modelId })
      .then(() => ipc.model.GetModels({}))
      .then((response) => {
        setModels(response.models);
        onChanged();
      })
      .catch((err: unknown) => { console.error('[ModelsPage] Delete error:', err); });
  };

  const handleSetActive = (modelId: string): void => {
    ipc.model.SetActiveModel({ modelId })
      .then(() => ipc.model.GetModels({}))
      .then((response) => {
        setModels(response.models);
        onChanged();
      })
      .catch((err: unknown) => { console.error('[ModelsPage] SetActive error:', err); });
  };

  const handleRevealInFinder = (modelId: string): void => {
    void ipc.model.RevealInFinder({ modelId });
  };

  const handleChangeStoragePath = (): void => {
    ipc.model.PickStoragePath({})
      .then((response) => {
        if (response.value === '') return Promise.resolve();
        return ipc.model.SetStoragePath({ path: response.value })
          .then(() => {
            setStoragePath(response.value);
            onChanged();
          });
      })
      .catch((err: unknown) => { console.error('[ModelsPage] Storage path error:', err); });
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">Models</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Download and manage local speech recognition models.
        </p>
      </div>

      <div className="space-y-3 mb-8">
        {models.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            onDownload={handleDownload}
            onCancelDownload={handleCancelDownload}
            onDelete={handleDelete}
            onSetActive={handleSetActive}
            onRevealInFinder={handleRevealInFinder}
          />
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Model storage location</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {storagePath !== '' ? storagePath : 'Default location'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleChangeStoragePath}>
            <FolderOpen className="w-4 h-4 mr-2" />
            Change…
          </Button>
        </div>
      </div>
    </div>
  );
}
