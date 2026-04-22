import { dock } from '@mobrowser/api';
import { native } from './gen/native';
import { SettingsStore } from './settings/SettingsStore';
import { ShortcutManager } from './system/ShortcutManager';
import { DockManager } from './system/DockManager';
import { SessionStorage } from './recording/SessionStorage';
import { HistoryStore } from './history/HistoryStore';
import { Clipboard } from './system/Clipboard';
import { RecordingSessionController } from './recording/RecordingSessionController';
import { TrayController } from './TrayController';
import { RecordingWindow } from './recording/RecordingWindow';
import { SettingsWindow } from './settings/SettingsWindow';
import { HistoryWindow } from './history/HistoryWindow';
import { AboutWindow } from './AboutWindow';
import { registerPermissionsIpc } from './system/PermissionsService';
import {
  registerRecordingIpc,
  registerBuiltinSpeechIpc,
} from './recording/RecordingSessionController';
import { registerReverseIpcBridge } from './ipc/ReverseIpcBridge';
import { registerSettingsIpc } from './settings/SettingsStore';
import { registerStatsIpc } from './settings/StatsCalculator';
import { registerHistoryIpc } from './history/HistoryStore';

/**
 * The application entry point.
 */
export class Application {
  private readonly settings = new SettingsStore();
  private readonly sessionStorage = new SessionStorage();
  private readonly historyStore = new HistoryStore(this.sessionStorage);

  private readonly recordingController = new RecordingSessionController(
    this.settings,
    this.historyStore,
    this.sessionStorage,
  );

  private readonly recordingWindow = new RecordingWindow(this.recordingController);
  private readonly dockManager = new DockManager();
  private readonly settingsWindow = new SettingsWindow(this.dockManager);
  private readonly historyWindow = new HistoryWindow(this.dockManager);
  private readonly aboutWindow = new AboutWindow(this.dockManager);

  private readonly trayController = new TrayController(
    this.recordingController,
    this.settings,
    this.settingsWindow,
    this.historyWindow,
    this.aboutWindow,
  );

  private readonly shortcutManager = new ShortcutManager();
  private readonly clipboard = new Clipboard();

  /**
   * Initialises all services in the correct order and shows the tray.
   */
  initialize(): void {
    this.historyStore.initialize();
    this.trayController.initialize();

    dock.hide();
    this.registerShortcut();

    registerPermissionsIpc(native.systemPermissions);
    registerReverseIpcBridge(this.recordingController);
    registerRecordingIpc(this.recordingController);
    registerBuiltinSpeechIpc(native.builtinSpeech, this.recordingController);
    registerSettingsIpc(this.settings, this.shortcutManager);
    registerStatsIpc(this.historyStore);
    registerHistoryIpc(this.historyStore, this.sessionStorage);

    this.recordingWindow.initialize();

    this.recordingController.onStateChange(() => { this.trayController.refresh(); });
    this.settings.onShortcutKeyChanged(() => { this.trayController.refresh(); });

    this.recordingController.onTranscriptionCompleted((text) => {
      void this.clipboard.execute(text);
    });
  }

  private registerShortcut(): void {
    const { shortcutKey } = this.settings.get();
    this.shortcutManager.register(shortcutKey, () => { this.recordingController.toggle(); });
  }
}
