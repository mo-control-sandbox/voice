import { BrowserWindow } from '@mobrowser/api';
import type { DockManager } from '../system/DockManager';
import { rendererWindowUrl } from '../RendererWindowUrl';
import { SingletonWindowController } from '../windowing/SingletonWindowController';
import { attachPermissionHandler } from '../windowing/attachPermissionHandler';
import type { WindowPermissionPolicy } from '../windowing/WindowPermissionPolicy';

/**
 * Manages the Settings dialog as a singleton window.
 */
export class SettingsWindow {
  private readonly windowController: SingletonWindowController;

  constructor(
    private readonly dockManager: DockManager,
    permissionPolicy: WindowPermissionPolicy,
  ) {
    this.windowController = new SingletonWindowController(() => {
      const window = new BrowserWindow({
        url: rendererWindowUrl('settings'),
        size: { width: 960, height: 700 },
        minimumSize: { width: 960, height: 700 },
        title: 'Settings',
        resizable: false
      });
      attachPermissionHandler(window, permissionPolicy);
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
