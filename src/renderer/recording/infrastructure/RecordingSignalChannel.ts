import { ipc } from '../../gen/ipc';
import type { RecordingState } from '../../gen/reverse_ipc_bridge';
import { PolledChannel } from '../../infra/ipc/PolledChannel';

const RECORDING_POLL_INTERVAL_MS = 1000 / 30;

/**
 * Polling channel that emits recording signal updates from main process.
 */
export const recordingSignalChannel = new PolledChannel<RecordingState, string>({
  intervalMs: RECORDING_POLL_INTERVAL_MS,
  poll: async () => {
    const response = await ipc.reverseIpcBridge.PollRecording({});
    return response.recording;
  },
  getKey: (snapshot) => `${snapshot.phase}:${snapshot.sessionId}`,
  logLabel: 'RecordingSignalChannel',
});
