import { BrowserWindow } from '@mobrowser/api';
import type { DockManager } from '../system/DockManager';
import { attachPermissionHandler } from '../system/Permissions';
import { rendererWindowUrl } from '../RendererWindowUrl';
import { SingletonWindow } from '../windowing/SingletonWindow';

/**
 * Manages the first-launch Welcome wizard as a singleton window.
 */
export class WelcomeWindow {
  private readonly windowController: SingletonWindow;

  constructor(private readonly dockManager: DockManager) {
    this.windowController = new SingletonWindow(() => {
      const size = { width: 680, height: 620 };
      const window = new BrowserWindow({
        url: rendererWindowUrl('welcome'),
        size,
        minimumSize: size,
        title: 'MoVoice Initial Configuration',
        resizable: false,
        windowTitleVisible: true,
        windowTitlebarVisible: true,
        windowButtonVisible: {
          close: true,
          minimize: false,
          maximize: false,
          zoom: false,
        },
      });
      attachPermissionHandler(window);
      window.centerWindow();
      this.dockManager.track(window);
      return window;
    });
  }

  show(): void {
    this.windowController.show();
  }
}
