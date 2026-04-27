import { BrowserWindow } from '@mobrowser/api';
import type { DockManager } from '../system/DockManager';
import { rendererWindowUrl } from '../RendererWindowUrl';
import { SingletonWindowController } from '../windowing/SingletonWindowController';
import { attachPermissionHandler } from '../windowing/attachPermissionHandler';
import type { WindowPermissionPolicy } from '../windowing/WindowPermissionPolicy';

/**
 * Manages the first-launch Welcome wizard as a singleton window.
 */
export class WelcomeWindow {
  private readonly windowController: SingletonWindowController;

  /**
   * Creates the singleton Welcome window controller and wires permission requests for onboarding flows.
   */
  constructor(
    private readonly dockManager: DockManager,
    permissionPolicy: WindowPermissionPolicy,
  ) {
    this.windowController = new SingletonWindowController(() => {
      const window = new BrowserWindow({
        url: rendererWindowUrl('welcome'),
        size: { width: 680, height: 620 },
        minimumSize: { width: 680, height: 620 },
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

  /**
   * Opens the Welcome window, or focuses it if already visible.
   */
  show(): void {
    this.windowController.show();
  }
}
