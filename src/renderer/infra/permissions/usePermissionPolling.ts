import { useCallback, useEffect, useRef, useState } from 'react';
import { PollingLoop } from '../ipc/PollingLoop';

interface PermissionPollingOptions {
  readonly intervalMs: number;
  readonly poll: () => Promise<boolean>;
}

/**
 * Re-checks permission state until the required condition is reached or polling expires.
 */
export function usePermissionPolling(options: PermissionPollingOptions): {
  readonly isPolling: boolean;
  readonly startPolling: () => void;
  readonly stopPolling: () => void;
} {
  const { intervalMs, poll } = options;
  const [isPolling, setIsPolling] = useState(false);
  const pollRef = useRef(poll);
  const loopRef = useRef<PollingLoop | null>(null);

  useEffect(() => {
    pollRef.current = poll;
  }, [poll]);

  useEffect(() => {
    loopRef.current = new PollingLoop({
      intervalMs,
      tick: async () => pollRef.current(),
      onStop: () => { setIsPolling(false); },
    });
    return () => {
      loopRef.current?.stop();
      loopRef.current = null;
    };
  }, [intervalMs]);

  const stopPolling = useCallback((): void => {
    loopRef.current?.stop();
    setIsPolling(false);
  }, []);

  const startPolling = useCallback((): void => {
    loopRef.current?.start();
    setIsPolling(true);
  }, []);

  return {
    isPolling,
    startPolling,
    stopPolling,
  };
}
