interface PollingLoopOptions {
  /**
   * Defines the delay between polling ticks.
   */
  readonly intervalMs: number;
  /**
   * Performs one polling iteration and returns true to stop the loop.
   */
  readonly tick: () => Promise<boolean>;
  /**
   * Handles errors thrown by the polling iteration.
   */
  readonly onError?: (error: unknown) => void;
  /**
   * Runs when the loop transitions from running to stopped.
   */
  readonly onStop?: () => void;
}

/**
 * Provides the shared main-to-renderer polling channel used by renderer features.
 *
 * Runs periodic async ticks without overlap so multiple domains can safely
 * receive main-process updates through a consistent polling mechanism.
 */
export class PollingLoop {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isTickRunning = false;

  constructor(private readonly options: PollingLoopOptions) {}

  /**
   * Returns whether the loop is currently active.
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  /**
   * Starts polling and performs an immediate tick.
   */
  start(): void {
    this.stop();

    this.intervalId = setInterval(() => {
      void this.runTick();
    }, this.options.intervalMs);
    void this.runTick();
  }

  /**
   * Stops polling and clears all timers.
   */
  stop(): void {
    const wasRunning = this.isRunning();
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isTickRunning = false;
    if (wasRunning) {
      this.options.onStop?.();
    }
  }

  private async runTick(): Promise<void> {
    if (!this.isRunning() || this.isTickRunning) return;
    this.isTickRunning = true;
    try {
      const shouldStop = await this.options.tick();
      if (shouldStop) {
        this.stop();
      }
    } catch (error: unknown) {
      this.options.onError?.(error);
    } finally {
      this.isTickRunning = false;
    }
  }
}
