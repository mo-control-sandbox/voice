import { BrowserWindow } from '@mobrowser/api';
import { attachPermissionHandler } from '../system/Permissions';
import type { DockManager } from '../system/DockManager';
import { rendererWindowUrl } from '../RendererWindowUrl';
import { SingletonWindow } from '../windowing/SingletonWindow';

/**
 * Manages the Settings dialog as a singleton window.
 */
export class SettingsWindow {
  private readonly windowController: SingletonWindow;

  constructor(private readonly dockManager: DockManager) {
    this.windowController = new SingletonWindow(() => {
      const size = { width: 960, height: 700 };
      const window = new BrowserWindow({
        url: rendererWindowUrl('settings'),
        size,
        minimumSize: size,
        title: 'MoVoice',
        resizable: false
      });
      attachPermissionHandler(window);
      window.setWindowButtonVisible('zoom', false);
      window.centerWindow();
      this.dockManager.track(window);
      return window;
    });
  }

  /**
   * Opens the Settings window, or focuses it if already visible.
   */
  show(): void {
    this.windowController.show();
  }
}
