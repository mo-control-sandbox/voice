import { BrowserWindow } from '@mobrowser/api';
import { attachPermissionHandler } from '../system/Permissions';
import type { DockManager } from '../system/DockManager';
import { rendererWindowUrl } from '../RendererWindowUrl';
import { SingletonWindow } from '../windowing/SingletonWindow';

export type SettingsSectionId = 'dashboard' | 'history' | 'general' | 'models' | 'permissions' | 'about';

/**
 * Manages the main application window.
 */
export class ApplicationWindow {
  private readonly windowController: SingletonWindow;

  constructor(private readonly dockManager: DockManager) {
    this.windowController = new SingletonWindow(() => {
      const size = { width: 960, height: 700 };
      const window = new BrowserWindow({
        url: rendererWindowUrl('app'),
        size,
        minimumSize: size,
        title: 'MoVoice',
        resizable: false,
        windowTitleVisible: false,
        windowTitlebarVisible: false,
        windowButtonPosition: { x: 19, y: 19 },
      });
      attachPermissionHandler(window);
      window.setWindowButtonVisible('zoom', false);
      window.centerWindow();
      this.dockManager.track(window);
      return window;
    });
  }

  /**
   * Opens the application window, or focuses it if already visible.
   */
  show(): void {
    this.windowController.show();
  }

  /**
   * Opens the application window and navigates to a specific top-level section.
   */
  showSection(section: SettingsSectionId): void {
    const targetUrl = rendererWindowUrl('app', `/${section}`);
    this.windowController.show((window) => {
      window.browser.loadUrl(targetUrl);
    });
  }
}
