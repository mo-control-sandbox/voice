import { BrowserWindow } from '@mobrowser/api';
import type { DockManager } from '../system/DockManager';
import { rendererWindowUrl } from '../RendererWindowUrl';
import { SingletonWindow } from '../windowing/SingletonWindow';
import { attachPermissionHandler } from '../windowing/attachPermissionHandler';
import type { WindowPermissionPolicy } from '../windowing/WindowPermissionPolicy';

/**
 * Manages the first-launch Welcome wizard as a singleton window.
 */
export class WelcomeWindow {
  private readonly windowController: SingletonWindow;

  constructor(
    private readonly dockManager: DockManager,
    permissionPolicy: WindowPermissionPolicy,
  ) {
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
      attachPermissionHandler(window, permissionPolicy);
      window.centerWindow();
      this.dockManager.track(window);
      return window;
    });
  }

  show(): void {
    this.windowController.show();
  }
}
