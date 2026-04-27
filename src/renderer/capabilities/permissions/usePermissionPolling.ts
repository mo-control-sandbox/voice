import { useCallback, useEffect, useRef, useState } from 'react';

interface PermissionPollingOptions {
  readonly intervalMs: number;
  readonly timeoutMs: number;
  readonly poll: () => Promise<boolean>;
}

/**
 * Owns reusable polling lifecycle with in-flight guard and optional timeout.
 */
export function usePermissionPolling(options: PermissionPollingOptions): {
  readonly isPolling: boolean;
  readonly startPolling: () => void;
  readonly stopPolling: () => void;
} {
  const { intervalMs, timeoutMs, poll } = options;
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollInFlightRef = useRef(false);
  const pollRef = useRef(poll);

  useEffect(() => {
    pollRef.current = poll;
  }, [poll]);

  const stopPolling = useCallback((): void => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    pollInFlightRef.current = false;
    setIsPolling(false);
  }, []);

  const startPolling = useCallback((): void => {
    stopPolling();
    setIsPolling(true);

    const runPoll = async (): Promise<void> => {
      if (pollInFlightRef.current) return;
      pollInFlightRef.current = true;
      try {
        const shouldStop = await pollRef.current();
        if (shouldStop) {
          stopPolling();
        }
      } finally {
        pollInFlightRef.current = false;
      }
    };

    intervalRef.current = setInterval(() => {
      void runPoll();
    }, intervalMs);
    void runPoll();

    if (timeoutMs > 0) {
      timeoutRef.current = setTimeout(() => {
        stopPolling();
      }, timeoutMs);
    }
  }, [intervalMs, stopPolling, timeoutMs]);

  return {
    isPolling,
    startPolling,
    stopPolling,
  };
}
