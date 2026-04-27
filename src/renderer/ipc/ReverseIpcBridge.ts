import { ipc } from '../gen/ipc';
import type { RecordingSignalSnapshotProto } from '../gen/reverse_ipc_bridge';

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
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastRecordingKey = '';
  private isTickRunning = false;

  /**
   * Registers a recording snapshot handler.
   */
  subscribe(handler: RecordingSignalHandler): () => void {
    this.handlers.add(handler);
    if (this.intervalId === null) this.startPolling();
    return () => { this.deregister(handler); };
  }

  private deregister(handler: RecordingSignalHandler): void {
    this.handlers.delete(handler);
    if (this.handlers.size === 0) this.stopPolling();
  }

  private startPolling(): void {
    this.intervalId = setInterval(() => { void this.tick(); }, RECORDING_POLL_INTERVAL_MS);
    void this.tick();
  }

  private stopPolling(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.isTickRunning) return;
    this.isTickRunning = true;
    try {
      const response = await ipc.reverseIpcBridge.PollRecording({});
      const snapshot = response.recording;
      if (snapshot === undefined) return;

      const recordingKey = `${snapshot.state}:${snapshot.sessionId}`;
      if (recordingKey === this.lastRecordingKey) return;

      this.lastRecordingKey = recordingKey;
      await dispatchHandlers(this.handlers, snapshot, 'recording');
    } catch (err) {
      console.error('[ReverseIpcBridge] PollRecording error:', err);
    } finally {
      this.isTickRunning = false;
    }
  }
}

/**
 * Renderer-local polling channel for history revision updates.
 */
class HistoryRevisionChannel {
  private readonly handlers = new Set<HistoryRevisionHandler>();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastHistoryRevision = -1;
  private isTickRunning = false;

  /**
   * Registers a history revision handler.
   */
  subscribe(handler: HistoryRevisionHandler): () => void {
    this.handlers.add(handler);
    if (this.intervalId === null) this.startPolling();
    return () => { this.deregister(handler); };
  }

  private deregister(handler: HistoryRevisionHandler): void {
    this.handlers.delete(handler);
    if (this.handlers.size === 0) this.stopPolling();
  }

  private startPolling(): void {
    this.intervalId = setInterval(() => { void this.tick(); }, HISTORY_POLL_INTERVAL_MS);
    void this.tick();
  }

  private stopPolling(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.isTickRunning) return;
    this.isTickRunning = true;
    try {
      const response = await ipc.reverseIpcBridge.PollHistoryRevision({});
      if (response.historyRevision === this.lastHistoryRevision) return;

      const isFirstPoll = this.lastHistoryRevision === -1;
      this.lastHistoryRevision = response.historyRevision;
      if (isFirstPoll) return;

      await dispatchHandlers(this.handlers, response.historyRevision, 'history revision');
    } catch (err) {
      console.error('[ReverseIpcBridge] PollHistoryRevision error:', err);
    } finally {
      this.isTickRunning = false;
    }
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
