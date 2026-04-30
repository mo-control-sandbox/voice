import { app, Tray, Menu, MenuItem } from '@mobrowser/api';
import type { RecordingSessionController } from './recording/RecordingSessionController';
import type { SettingsStore } from './settings/SettingsStore';
import type { SettingsWindow } from './settings/SettingsWindow';
import type { HistoryWindow } from './sessions/HistoryWindow';
import type { AboutWindow } from './AboutWindow';
import type { ReadinessCoordinator } from './readiness/ReadinessCoordinator';

/**
 * Manages the menu-bar tray icon for MoVoice.
 */
export class TrayController {
  private readonly tray: Tray;
  private isReady = false;

  constructor(
    private readonly controller: RecordingSessionController,
    private readonly settings: SettingsStore,
    private readonly readiness: ReadinessCoordinator,
    private readonly settingsWindow: SettingsWindow,
    private readonly historyWindow: HistoryWindow,
    private readonly aboutWindow: AboutWindow,
  ) {
    const imagePath = `${app.getPath('appResources')}/imageTemplate.png`;
    this.tray = new Tray({ imagePath, tooltip: 'MoVoice' });
    this.tray.on('mouseUp', () => { this.tray.openMenu(); });
    this.registerReadinessListener();
  }

  /**
   * Synchronizes tray readiness state with the readiness coordinator.
   */
  private registerReadinessListener(): void {
    this.readiness.onChange((ready) => {
      this.isReady = ready;
      this.refresh();
    });
  }

  /**
   * Rebuilds the context menu from the current recording state.
   */
  refresh(): void {
    const state = this.controller.getState();
    const { shortcutKey } = this.settings.get();
    const hasCompletedOnboarding = this.settings.hasCompletedOnboarding();
    const recordingMenuItem = state !== 'idle'
      ? new MenuItem({
          id: 'stopRecording',
          label: 'Stop',
          shortcut: shortcutKey,
          action: () => { this.controller.cancel(); },
        })
      : (
          this.isReady
            ? new MenuItem({
                id: 'startRecording',
                label: 'Start Recording',
                shortcut: shortcutKey,
                enabled: true,
                action: () => {
                  void this.controller.start();
                },
              })
            : new MenuItem({
                id: 'continueSetup',
                label: 'Continue Setup',
                enabled: hasCompletedOnboarding,
                action: () => {
                  if (hasCompletedOnboarding) this.settingsWindow.show();
                },
              })
        );
    this.tray.setMenu(
      new Menu({
        items: [
          recordingMenuItem,
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
            label: 'About MoVoice',
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
