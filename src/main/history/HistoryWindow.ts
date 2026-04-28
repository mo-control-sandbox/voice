import { BrowserWindow } from '@mobrowser/api';
import type { DockManager } from '../system/DockManager';
import { rendererWindowUrl } from '../RendererWindowUrl';
import { SingletonWindowController } from '../windowing/SingletonWindowController';

/**
 * Manages the History dialog as a singleton window.
 */
export class HistoryWindow {
  private readonly windowController: SingletonWindowController;

  constructor(private readonly dockManager: DockManager) {
    this.windowController = new SingletonWindowController(() => {
      const window = new BrowserWindow({
        url: rendererWindowUrl('history'),
        size: { width: 800, height: 600 },
        minimumSize: { width: 800, height: 600 },
        title: 'History',
        resizable: false,
      });
      window.setWindowButtonVisible('zoom', false);
      window.centerWindow();
      this.dockManager.track(window);
      return window;
    });
  }

  /**
   * Opens the History window, or focuses it if already visible.
   */
  show(): void {
    this.windowController.show();
  }
}
