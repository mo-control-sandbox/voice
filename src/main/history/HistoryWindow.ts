import { BrowserWindow } from '@mobrowser/api';
import type { DockManager } from '../system/DockManager';
import { rendererWindowUrl } from '../RendererWindowUrl';

/**
 * Manages the History dialog as a singleton window.
 */
export class HistoryWindow {
  private window: BrowserWindow | null = null;

  constructor(private readonly dockManager: DockManager) {}

  /**
   * Opens the History window, or focuses it if already visible.
   */
  show(): void {
    if (this.window === null || this.window.isClosed) {
      this.window = new BrowserWindow({
        url: rendererWindowUrl('history'),
        size: { width: 800, height: 600 },
        minimumSize: { width: 800, height: 600 },
        title: 'History',
      });
      this.window.setWindowButtonVisible('zoom', false);
      this.window.centerWindow();
      this.dockManager.track(this.window);
    }
    if (this.window.isVisible) {
      this.window.focus();
    } else {
      this.window.show();
    }
  }
}
