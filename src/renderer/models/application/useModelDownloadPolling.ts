import { useEffect, useRef } from 'react';
import type { ModelEntry } from '../../types/models';
import { PollingLoop } from '../../infra/ipc/PollingLoop';

function hasActiveDownload(models: readonly ModelEntry[]): boolean {
  return models.some((model) => model.downloadProgress !== null);
}

/**
 * Starts polling while any model download is in progress.
 */
export function useModelDownloadPolling(
  models: readonly ModelEntry[],
  refresh: () => Promise<void>,
  intervalMs: number,
): void {
  const pollingRef = useRef<PollingLoop | null>(null);

  useEffect(() => {
    pollingRef.current ??= new PollingLoop({
      intervalMs,
      tick: async () => {
        await refresh();
        return false;
      },
    });

    if (hasActiveDownload(models)) {
      pollingRef.current.start();
    } else {
      pollingRef.current.stop();
    }

    return () => {
      if (pollingRef.current !== null) {
        pollingRef.current.stop();
        pollingRef.current = null;
      }
    };
  }, [intervalMs, models, refresh]);
}
