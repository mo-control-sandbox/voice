import { PollingLoop } from './PollingLoop';

/**
 * Function that handles one payload update from a polled channel.
 */
type ChannelHandler<TPayload> = (payload: TPayload) => Promise<void>;

interface PolledChannelOptions<TPayload, TKey> {
  /**
   * Defines the delay between poll requests.
   */
  readonly intervalMs: number;
  /**
   * Reads the latest payload from the main process.
   */
  readonly poll: () => Promise<TPayload | undefined>;
  /**
   * Computes a stable key used to suppress duplicate payload dispatches.
   */
  readonly getKey: (payload: TPayload) => TKey;
  /**
   * Skips dispatch of the first observed payload while still caching its key.
   */
  readonly skipFirst?: boolean;
  /**
   * Defines the log prefix for poll and handler errors.
   */
  readonly logLabel: string;
}

/**
 * Polls a main-process source and dispatches changed payloads to subscribers.
 */
export class PolledChannel<TPayload, TKey> {
  private readonly handlers = new Set<ChannelHandler<TPayload>>();
  private readonly pollingLoop: PollingLoop;
  private lastKey: TKey | undefined;

  constructor(private readonly options: PolledChannelOptions<TPayload, TKey>) {
    this.pollingLoop = new PollingLoop({
      intervalMs: options.intervalMs,
      tick: async () => this.tick(),
      onError: (error: unknown) => {
        console.error(`[${options.logLabel}] poll error:`, error);
      },
    });
  }

  /**
   * Registers a payload handler and starts polling when the first handler subscribes.
   */
  subscribe(handler: ChannelHandler<TPayload>): () => void {
    this.handlers.add(handler);
    if (!this.pollingLoop.isRunning()) this.pollingLoop.start();
    return () => {
      this.handlers.delete(handler);
      if (this.handlers.size === 0) this.pollingLoop.stop();
    };
  }

  private async tick(): Promise<boolean> {
    const payload = await this.options.poll();
    if (payload === undefined) return false;

    const key = this.options.getKey(payload);
    if (this.lastKey !== undefined && Object.is(key, this.lastKey)) {
      return false;
    }

    const isFirstPayload = this.lastKey === undefined;
    this.lastKey = key;
    if (isFirstPayload && this.options.skipFirst) {
      return false;
    }

    await this.dispatch(payload);
    return false;
  }

  private async dispatch(payload: TPayload): Promise<void> {
    const results = await Promise.allSettled(
      Array.from(this.handlers, (handler) => handler(payload)),
    );
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error(`[${this.options.logLabel}] handler error:`, result.reason);
      }
    }
  }
}
