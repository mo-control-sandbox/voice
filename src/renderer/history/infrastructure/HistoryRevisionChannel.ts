import { ipc } from '../../gen/ipc';
import { PolledChannel } from '../../infra/ipc/PolledChannel';

const HISTORY_POLL_INTERVAL_MS = 1000;

/**
 * Polling channel that emits history revision updates from main process.
 */
export const historyRevisionChannel = new PolledChannel<number, number>({
  intervalMs: HISTORY_POLL_INTERVAL_MS,
  poll: async () => {
    const response = await ipc.reverseIpcBridge.PollHistoryRevision({});
    return response.historyRevision;
  },
  getKey: (revision) => revision,
  skipFirst: true,
  logLabel: 'HistoryRevisionChannel',
});
