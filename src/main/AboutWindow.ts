import { BrowserWindow } from '@mobrowser/api';
import type { DockManager } from './system/DockManager';
import { rendererWindowUrl } from './RendererWindowUrl';
import { SingletonWindow } from './windowing/SingletonWindow';

/**
 * Manages the About dialog as a singleton window.
 */
export class AboutWindow {
  private readonly windowController: SingletonWindow;

  /**
   * Creates the singleton About window controller and registers the window with dock visibility tracking.
   */
  constructor(private readonly dockManager: DockManager) {
    this.windowController = new SingletonWindow(() => {
      const size = { width: 400, height: 300 };
      const window = new BrowserWindow({
        url: rendererWindowUrl('about'),
        size,
        minimumSize: size,
        title: 'About MoVoice',
        windowTitlebarVisible: true,
        resizable: false
      });
      window.setWindowButtonVisible('zoom', false);
      window.centerWindow();
      this.dockManager.track(window);
      return window;
    });
  }

  /**
   * Opens the About window, or focuses it if already visible.
   */
  show(): void {
    this.windowController.show();
  }
}
