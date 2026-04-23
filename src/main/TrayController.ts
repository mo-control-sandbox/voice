import { app, Tray, Menu, MenuItem } from '@mobrowser/api';
import type { RecordingSessionController } from './recording/RecordingSessionController';
import type { SettingsStore } from './settings/SettingsStore';
import type { SettingsWindow } from './settings/SettingsWindow';
import type { HistoryWindow } from './history/HistoryWindow';
import type { AboutWindow } from './AboutWindow';
import type { WelcomeWindow } from './welcome/WelcomeWindow';
import type { AppReadinessService } from './readiness/AppReadinessService';

/**
 * Manages the menu-bar tray icon for moVoice.
 */
export class TrayController {
  private tray: Tray | null = null;

  constructor(
    private readonly controller: RecordingSessionController,
    private readonly settings: SettingsStore,
    private readonly settingsWindow: SettingsWindow,
    private readonly historyWindow: HistoryWindow,
    private readonly aboutWindow: AboutWindow,
    private readonly welcomeWindow: WelcomeWindow,
    private readonly readiness: AppReadinessService,
  ) {}

  /**
   * Creates the tray icon and performs the first menu build.
   */
  initialize(): void {
    const imagePath = `${app.getPath('appResources')}/imageTemplate.png`;
    this.tray = new Tray({ imagePath, tooltip: 'moVoice' });
    this.tray.on('mouseUp', () => { this.tray?.openMenu(); });
    this.refresh();
  }

  /**
   * Rebuilds the context menu from the current recording state.
   */
  refresh(): void {
    if (this.tray === null) return;

    const state = this.controller.getState();
    const { shortcutKey } = this.settings.get();
    this.tray.setMenu(
      new Menu({
        items: [
          state === 'recording'
            ? new MenuItem({
                id: 'stopRecording',
                label: 'Stop Recording',
                shortcut: shortcutKey,
                action: () => { this.controller.stop(); },
              })
            : new MenuItem({
                id: 'startRecording',
                label: 'Start Recording',
                shortcut: shortcutKey,
                enabled: state === 'idle',
                action: () => {
                  void this.readiness.isReady().then((ready) => {
                    if (!ready) {
                      this.welcomeWindow.show();
                    } else {
                      this.controller.start();
                    }
                  });
                },
              }),
          new MenuItem({
            id: 'openHistory',
            label: 'History',
            action: () => { this.historyWindow.show(); },
          }),
          'separator',
          new MenuItem({
            id: 'openSettings',
            label: 'Settings',
            action: () => { this.settingsWindow.show(); },
          }),
          new MenuItem({
            id: 'openAbout',
            label: 'About moVoice',
            action: () => { this.aboutWindow.show(); },
          }),
          'separator',
          new MenuItem({
            id: 'quit',
            label: 'Quit',
            action: () => { app.quit(); },
          }),
        ],
      }),
    );
  }
}
