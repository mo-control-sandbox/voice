import { app, Tray, Menu, MenuItem } from '@mobrowser/api';
import type { RecordingSessionController } from './recording/RecordingSessionController';
import type { SettingsWindow } from './settings/SettingsWindow';
import type { HistoryWindow } from './history/HistoryWindow';
import { showAboutWindow } from './AboutWindow';

/**
 * Manages the menu-bar tray icon for moVoice.
 */
export class TrayController {
  private tray: Tray | null = null;

  constructor(
    private readonly controller: RecordingSessionController,
    private readonly settingsWindow: SettingsWindow,
    private readonly historyWindow: HistoryWindow,
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
    this.tray.setMenu(
      new Menu({
        items: [
          state === 'recording'
            ? new MenuItem({
                id: 'stopRecording',
                label: 'Stop Recording',
                action: () => { this.controller.stop(); },
              })
            : new MenuItem({
                id: 'startRecording',
                label: 'Start Recording',
                enabled: state === 'idle',
                action: () => { this.controller.start(); },
              }),
          'separator',
          new MenuItem({
            id: 'openSettings',
            label: 'Open Settings',
            action: () => { this.settingsWindow.show(); },
          }),
          new MenuItem({
            id: 'openHistory',
            label: 'Open History',
            action: () => { this.historyWindow.show(); },
          }),
          new MenuItem({
            id: 'openAbout',
            label: 'Open About',
            action: () => { showAboutWindow(); },
          }),
        ],
      }),
    );
  }
}
