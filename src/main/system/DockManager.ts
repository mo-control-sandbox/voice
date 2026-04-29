import { dock } from '@mobrowser/api';
import type { BrowserWindow } from '@mobrowser/api';

/**
 * Centralises macOS Dock visibility for the application.
 *
 * Any window that should cause the Dock icon to appear while it is open
 * registers itself via track(). The icon is shown when the first tracked
 * window opens and hidden when the last one closes — but only after hiding
 * has been enabled via enableHiding(). Until then the Dock icon is left
 * visible (the OS default) until hiding is enabled.
 */
export class DockManager {
  private openCount = 0;
  private hidingEnabled = false;

  /**
   * Applies the initial Dock state.
   */
  initialize(hidingEnabledInitially: boolean): void {
    if (hidingEnabledInitially) {
      this.enableHiding();
    }
  }

  /**
   * Allows the Dock icon to be hidden. If no tracked window is currently
   * open, hides the Dock immediately.
   */
  enableHiding(): void {
    this.hidingEnabled = true;
    if (this.openCount === 0) {
      dock.hide();
    }
  }

  /**
   * Attaches shown/closed listeners to the window so it participates in
   * the shared Dock visibility count.
   *
   * Call this once per BrowserWindow instance, immediately after creation.
   */
  track(window: BrowserWindow): void {
    let isTrackedAsVisible = false;

    const markVisible = (): void => {
      if (isTrackedAsVisible) {
        return;
      }
      isTrackedAsVisible = true;
      this.openCount++;
      if (this.openCount === 1) {
        dock.show();
      }
    };

    const markHidden = (): void => {
      if (!isTrackedAsVisible) {
        return;
      }
      isTrackedAsVisible = false;
      this.openCount = Math.max(0, this.openCount - 1);
      if (this.openCount === 0 && this.hidingEnabled) {
        dock.hide();
      }
    };

    // track() is always called from within createWindow() factories, which are only
    // invoked from show(). The window is always about to become visible, so mark it
    // immediately rather than waiting for a 'shown' event that may not be reliable.
    markVisible();

    window.on('shown', markVisible);
    window.on('hidden', markHidden);
    window.on('closed', markHidden);
  }
}
