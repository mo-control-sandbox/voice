import { BrowserWindow } from '@mobrowser/api';
import type { DockManager } from '../system/DockManager';
import { rendererWindowUrl } from '../RendererWindowUrl';
import { SingletonWindow } from '../windowing/SingletonWindow';

/**
 * The history window.
 */
export class HistoryWindow {
  private readonly windowController: SingletonWindow;

  constructor(private readonly dockManager: DockManager) {
    this.windowController = new SingletonWindow(() => {
      const size = { width: 800, height: 600 };
      const window = new BrowserWindow({
        url: rendererWindowUrl('history'),
        size,
        minimumSize: size,
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
