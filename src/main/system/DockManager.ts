import { app, dock } from '@mobrowser/api';
import type { BrowserWindow } from '@mobrowser/api';

/**
 * Shows the dock icon when at least one window of the application is visible.
 */
export class DockManager {
  /**
   * Serializes dock visibility mutations so they do not overlap.
   */
  private dockVisibilityQueue: Promise<void> = Promise.resolve();

  /**
   * Tracks when the last dock visibility mutation completed.
   */
  private lastDockMutationAtMs = 0;

  initialize(): void {
    this.syncDockVisibility();
  }

  /**
   * Registers a window with DockManager so Dock visibility stays aligned with
   * whether any window is open.
   */
  track(window: BrowserWindow): void {
    if (window.isVisible) {
      throw new Error('DockManager.track() must be called before the window is shown.');
    }

    window.on('shown', () => {
      this.syncDockVisibility();
    });
    window.on('hidden', () => {
      this.syncDockVisibility();
    });
    window.on('closed', () => {
      this.syncDockVisibility();
    });
  }

  /**
   * Synchronizes Dock visibility with the current set of visible application windows.
   */
  private syncDockVisibility(): void {
    const hasVisibleWindow = app.windows.some((window) => !window.isClosed && window.isVisible);
    this.enqueueDockVisibility(hasVisibleWindow);
  }

  /**
   * Applies a dock visibility mutation after waiting for the queue turn and delay.
   */
  private enqueueDockVisibility(shouldShow: boolean): void {
    this.dockVisibilityQueue = this.dockVisibilityQueue
      .catch(() => undefined)
      .then(async () => {
        const elapsedMs = Date.now() - this.lastDockMutationAtMs;
        if (this.lastDockMutationAtMs !== 0 && elapsedMs < 500) {
          await this.delay(500 - elapsedMs);
        }
        if (shouldShow) {
          dock.show();
        } else {
          dock.hide();
        }
        this.lastDockMutationAtMs = Date.now();
      });
  }

  /**
   * Waits for the provided duration in milliseconds.
   */
  private async delay(durationMs: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, durationMs);
    });
  }
}
