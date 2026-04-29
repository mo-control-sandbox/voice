import { app, Tray, Menu, MenuItem } from '@mobrowser/api';
import type { RecordingSessionController } from './recording/RecordingSessionController';
import type { SettingsStore } from './settings/SettingsStore';
import type { SettingsWindow } from './settings/SettingsWindow';
import type { HistoryWindow } from './history/HistoryWindow';
import type { AboutWindow } from './AboutWindow';
import type { StartRecordingFromIntentUseCase } from './recording/StartRecordingFromIntentUseCase';

/**
 * Manages the menu-bar tray icon for MoVoice.
 */
export class TrayController {
  private tray: Tray | null = null;
  private isReady = false;

  constructor(
    private readonly controller: RecordingSessionController,
    private readonly startRecordingFromIntent: StartRecordingFromIntentUseCase,
    private readonly settings: SettingsStore,
    private readonly settingsWindow: SettingsWindow,
    private readonly historyWindow: HistoryWindow,
    private readonly aboutWindow: AboutWindow,
  ) {}

  /**
   * Creates the tray icon and performs the first menu build.
   */
  initialize(): void {
    const imagePath = `${app.getPath('appResources')}/imageTemplate.png`;
    this.tray = new Tray({ imagePath, tooltip: 'MoVoice' });
    this.tray.on('mouseUp', () => { this.tray?.openMenu(); });
    this.refresh();
  }

  setReadiness(isReady: boolean): void {
    this.isReady = isReady;
  }

  /**
   * Rebuilds the context menu from the current recording state.
   */
  refresh(): void {
    if (this.tray === null) return;

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
                  void this.startRecordingFromIntent.startFromUserIntent();
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
