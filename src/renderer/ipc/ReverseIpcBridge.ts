import { ipc } from '../gen/ipc';
import { type SignalServiceInstance } from './SignalService';

const POLL_INTERVAL_MS = 1000 / 30; // 30 fps — satisfies the fastest consumer (recording window)

/**
 * Singleton polling bus that drives all main-to-renderer signal delivery.
 *
 * Consumers register typed signal service handlers via registerService(); the bus
 * owns the single polling interval and dispatches to handlers only when a revision
 * changes. This is the renderer-side analogue of MoBrowser's ipc.registerService()
 * infrastructure.
 *
 * The bus auto-starts on first registration and auto-stops when all services have
 * been unregistered, so consumers need not manage lifecycle explicitly.
 */
class ReverseIpcBridgeBus {
  private readonly services = new Set<SignalServiceInstance>();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastRecordingKey = '';

  /**
   * Registers a signal service handler.
   *
   * Returns an unsubscribe function -- call it when the consumer unmounts.
   */
  registerService(svc: SignalServiceInstance): () => void {
    this.services.add(svc);
    if (this.intervalId === null) this.startPolling();
    return () => { this.deregister(svc); };
  }

  private deregister(svc: SignalServiceInstance): void {
    this.services.delete(svc);
    if (this.services.size === 0) this.stopPolling();
  }

  private startPolling(): void {
    this.intervalId = setInterval(() => { void this.tick(); }, POLL_INTERVAL_MS);
    void this.tick();
  }

  private stopPolling(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async tick(): Promise<void> {
    let resp;
    try {
      resp = await ipc.reverseIpcBridge.Poll({});
    } catch (err) {
      console.error('[ReverseIpcBridge] Poll error:', err);
      return;
    }

    if (resp.recording !== undefined) {
      const recordingKey = `${resp.recording.state}:${resp.recording.sessionId}`;
      if (recordingKey !== this.lastRecordingKey) {
        this.lastRecordingKey = recordingKey;
        const snapshot = resp.recording;
        for (const svc of this.services) {
          await svc.onRecordingChanged?.(snapshot);
        }
      }
    }
  }
}

/** Singleton reverse IPC bridge for all renderer windows. */
export const reverseIpcBridge = new ReverseIpcBridgeBus();
