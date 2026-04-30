import { ipc } from '../gen/ipc';
import type { RecordingSignalSnapshotProto } from '../gen/reverse_ipc_bridge';
import { PollingLoop } from '../capabilities/polling/PollingLoop';

const RECORDING_POLL_INTERVAL_MS = 1000 / 30;
const HISTORY_POLL_INTERVAL_MS = 1000;

/**
 * Handler invoked when the recording snapshot changes.
 */
type RecordingSignalHandler = (snapshot: RecordingSignalSnapshotProto) => Promise<void>;

/**
 * Handler invoked when the history revision changes.
 */
type HistoryRevisionHandler = (revision: number) => Promise<void>;

/**
 * Renderer-local polling channel for recording state snapshots.
 */
class RecordingSignalChannel {
  private readonly handlers = new Set<RecordingSignalHandler>();
  private readonly pollingLoop = new PollingLoop({
    intervalMs: RECORDING_POLL_INTERVAL_MS,
    tick: async () => this.tick(),
    onError: (err: unknown) => {
      console.error('[ReverseIpcBridge] PollRecording error:', err);
    },
  });
  private lastRecordingKey = '';

  /**
   * Registers a recording snapshot handler.
   */
  subscribe(handler: RecordingSignalHandler): () => void {
    this.handlers.add(handler);
    if (!this.pollingLoop.isRunning()) this.startPolling();
    return () => { this.deregister(handler); };
  }

  private deregister(handler: RecordingSignalHandler): void {
    this.handlers.delete(handler);
    if (this.handlers.size === 0) this.stopPolling();
  }

  private startPolling(): void {
    this.pollingLoop.start();
  }

  private stopPolling(): void {
    this.pollingLoop.stop();
  }

  private async tick(): Promise<boolean> {
    const response = await ipc.reverseIpcBridge.PollRecording({});
    const snapshot = response.recording;
    if (snapshot === undefined) return false;

    const recordingKey = `${snapshot.state}:${snapshot.sessionId}`;
    if (recordingKey === this.lastRecordingKey) return false;

    this.lastRecordingKey = recordingKey;
    await dispatchHandlers(this.handlers, snapshot, 'recording');
    return false;
  }
}

/**
 * Renderer-local polling channel for history revision updates.
 */
class HistoryRevisionChannel {
  private readonly handlers = new Set<HistoryRevisionHandler>();
  private readonly pollingLoop = new PollingLoop({
    intervalMs: HISTORY_POLL_INTERVAL_MS,
    tick: async () => this.tick(),
    onError: (err: unknown) => {
      console.error('[ReverseIpcBridge] PollHistoryRevision error:', err);
    },
  });
  private lastHistoryRevision = -1;

  /**
   * Registers a history revision handler.
   */
  subscribe(handler: HistoryRevisionHandler): () => void {
    this.handlers.add(handler);
    if (!this.pollingLoop.isRunning()) this.startPolling();
    return () => { this.deregister(handler); };
  }

  private deregister(handler: HistoryRevisionHandler): void {
    this.handlers.delete(handler);
    if (this.handlers.size === 0) this.stopPolling();
  }

  private startPolling(): void {
    this.pollingLoop.start();
  }

  private stopPolling(): void {
    this.pollingLoop.stop();
  }

  private async tick(): Promise<boolean> {
    const response = await ipc.reverseIpcBridge.PollHistoryRevision({});
    if (response.historyRevision === this.lastHistoryRevision) return false;

    const isFirstPoll = this.lastHistoryRevision === -1;
    this.lastHistoryRevision = response.historyRevision;
    if (isFirstPoll) return false;

    await dispatchHandlers(this.handlers, response.historyRevision, 'history revision');
    return false;
  }
}

async function dispatchHandlers<T>(
  handlers: Set<(payload: T) => Promise<void>>,
  payload: T,
  channel: string,
): Promise<void> {
  const results = await Promise.allSettled(Array.from(handlers, (handler) => handler(payload)));
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error(`[ReverseIpcBridge] ${channel} handler error:`, result.reason);
    }
  }
}

/** Process-local recording signal channel singleton for the current renderer process. */
export const recordingSignalChannel = new RecordingSignalChannel();

/** Process-local history revision channel singleton for the current renderer process. */
export const historyRevisionChannel = new HistoryRevisionChannel();
