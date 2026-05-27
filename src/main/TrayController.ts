import { app, Tray, Menu, MenuItem } from '@mobrowser/api';
import type { RecordingSessionController } from './recording/RecordingSessionController';
import type { SettingsStore } from './settings/SettingsStore';
import type { ApplicationWindow } from './settings/ApplicationWindow';
import type { ReadinessCoordinator } from './readiness/ReadinessCoordinator';
import type { WelcomeWindow } from './welcome/WelcomeWindow';

/**
 * Manages the menu-bar tray icon for MōVoice.
 */
export class TrayController {
  private readonly tray: Tray;
  private isReady = false;

  constructor(
    private readonly controller: RecordingSessionController,
    private readonly settings: SettingsStore,
    private readonly readiness: ReadinessCoordinator,
    private readonly applicationWindow: ApplicationWindow,
    private readonly welcomeWindow: WelcomeWindow,
  ) {
    const imagePath = `${app.getPath('appResources')}/imageTemplate.png`;
    this.tray = new Tray({ imagePath, tooltip: 'MōVoice' });
    this.tray.on('mouseUp', () => { this.tray.openMenu(); });
    this.readiness.onChange((ready) => {
      this.isReady = ready;
      this.refresh();
    });
  }

  /**
   * Rebuilds the context menu from the current recording state.
   */
  refresh(): void {
    const items = [
      this.createRecordingActionItem(),
      ...this.createNavigationItems(),
      ...this.createApplicationItems(),
    ];
    this.tray.setMenu(new Menu({ items }));
  }

  /**
   * Returns the primary action item based on recording and readiness state.
   */
  private createRecordingActionItem(): MenuItem {
    const state = this.controller.getState();
    const { shortcutKey } = this.settings.get();
    if (state !== 'idle') {
      return new MenuItem({
        id: 'stopRecording',
        label: 'Stop',
        shortcut: shortcutKey,
        action: () => { this.controller.cancel(); },
      });
    }
    if (this.isReady) {
      return new MenuItem({
        id: 'startRecording',
        label: 'Start Recording',
        shortcut: shortcutKey,
        enabled: true,
        action: () => {
          void this.controller.start();
        },
      });
    }

    const hasCompletedOnboarding = this.settings.hasCompletedOnboarding();
    return new MenuItem({
      id: 'continueSetup',
      label: 'Continue Setup',
      action: () => {
        if (hasCompletedOnboarding) {
          this.applicationWindow.show();
        } else {
          this.welcomeWindow.show();
        }
      },
    });
  }

  /**
   * Returns items that navigate to secondary application windows.
   */
  private createNavigationItems(): (MenuItem | 'separator')[] {
    return [
      new MenuItem({
        id: 'openHistory',
        label: 'History',
        action: () => { this.applicationWindow.showSection('history'); },
      }),
      'separator',
      new MenuItem({
        id: 'openSettings',
        label: 'Settings',
        action: () => { this.applicationWindow.showSection('general'); },
      }),
      new MenuItem({
        id: 'openAbout',
        label: 'About MōVoice',
        action: () => { this.applicationWindow.showSection('about'); },
      }),
    ];
  }

  /**
   * Returns items that manage application-level actions.
   */
  private createApplicationItems(): (MenuItem | 'separator')[] {
    return [
      'separator',
      new MenuItem({
        id: 'quit',
        label: 'Quit',
        action: () => { app.quit(); },
      }),
    ];
  }
}
