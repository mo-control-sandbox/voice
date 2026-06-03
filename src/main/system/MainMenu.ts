import { app, Menu, MenuItem, MenuWithRole } from '@mobrowser/api';
import type { ApplicationWindow } from '../settings/ApplicationWindow';

/**
 * The main system menu of the application.
 */
export class MainMenu {
  constructor(private readonly applicationWindow: ApplicationWindow) {}

  /**
   * Installs the native menu used by macOS.
   */
  create(): void {
    app.setMenu(new Menu({
      items: [
        this.createAppMenu(),
      ],
    }));
  }

  /**
   * Creates the app menu containing settings and standard macOS visibility actions.
   */
  private createAppMenu(): MenuWithRole {
    return new MenuWithRole({
      role: 'macAppMenu',
      items: [
        new MenuItem({
          id: 'openAbout',
          label: 'About MōVoice',
          action: () => { this.applicationWindow.showSection('about'); },
        }),
        'separator',
        new MenuItem({
          id: 'openPreferences',
          label: 'Preferences',
          shortcut: 'CommandOrControl+,',
          action: () => { this.applicationWindow.showSection('settings'); },
        }),
        'separator',
        'macHideApp',
        'macHideOthers',
        'macShowAll',
        'separator',
        'quit',
      ],
    });
  }
}
