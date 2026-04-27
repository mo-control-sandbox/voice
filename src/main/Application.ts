import { dock } from '@mobrowser/api';
import { native } from './gen/native';
import { SettingsStore } from './settings/SettingsStore';
import { ShortcutManager } from './system/ShortcutManager';
import { DockManager } from './system/DockManager';
import { SessionStorage } from './recording/SessionStorage';
import { HistoryStore } from './history/HistoryStore';
import { Clipboard } from './system/Clipboard';
import { FocusRestorer } from './system/FocusRestorer';
import { RecordingSessionController } from './recording/RecordingSessionController';
import { TrayController } from './TrayController';
import { BackgroundWindow } from './recording/BackgroundWindow';
import { RecordingOverlay } from './recording/RecordingOverlay';
import { SettingsWindow } from './settings/SettingsWindow';
import { HistoryWindow } from './history/HistoryWindow';
import { AboutWindow } from './AboutWindow';
import { WelcomeWindow } from './welcome/WelcomeWindow';
import { AppReadinessService } from './readiness/AppReadinessService';
import { registerPermissionsIpc } from './system/PermissionsService';
import { registerRecordingIpc } from './recording/RecordingSessionController';
import { registerReverseIpcBridge } from './ipc/ReverseIpcBridge';
import { registerSettingsIpc } from './settings/SettingsStore';
import { registerStatsIpc } from './settings/StatsCalculator';
import { registerHistoryIpc } from './history/HistoryStore';
import { registerDesktopIpc } from './system/DesktopService';

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

  private readonly backgroundWindow = new BackgroundWindow();
  private readonly recordingOverlay = new RecordingOverlay(this.recordingController);
  private readonly dockManager = new DockManager();
  private readonly settingsWindow = new SettingsWindow(this.dockManager);
  private readonly historyWindow = new HistoryWindow(this.dockManager);
  private readonly aboutWindow = new AboutWindow(this.dockManager);
  private readonly welcomeWindow = new WelcomeWindow(this.dockManager);
  private readonly readiness = new AppReadinessService(this.settings, native.systemPermissions);

  private readonly trayController = new TrayController(
    this.recordingController,
    this.settings,
    this.settingsWindow,
    this.historyWindow,
    this.aboutWindow,
    this.welcomeWindow,
    this.readiness,
  );

  private readonly shortcutManager = new ShortcutManager();
  private readonly clipboard = new Clipboard();
  private readonly focusRestorer = new FocusRestorer();

  /**
   * Initialises all services in the correct order and shows the tray.
   */
  initialize(): void {
    this.historyStore.initialize();
    this.backgroundWindow.initialize();
    this.trayController.initialize();

    dock.hide();
    this.registerShortcut();

    registerDesktopIpc();
    registerPermissionsIpc(native.systemPermissions);
    registerReverseIpcBridge(this.recordingController, this.historyStore);
    registerRecordingIpc(this.recordingController);
    registerSettingsIpc(this.settings, this.shortcutManager);
    registerStatsIpc(this.historyStore);
    registerHistoryIpc(this.historyStore, this.sessionStorage);

    this.recordingOverlay.initialize();

    if (!this.settings.hasCompletedOnboarding()) {
      this.welcomeWindow.show();
    }

    this.recordingController.onStateChange(() => { this.trayController.refresh(); });
    this.settings.onShortcutKeyChanged(() => { this.trayController.refresh(); });
    this.settings.onOnboardingCompletionChanged(() => { this.trayController.refresh(); });

    let streamingFocusRestored = false;

    this.recordingController.onStateChange((state) => {
      if (state === 'recording') streamingFocusRestored = false;
      if (state === 'idle') this.focusRestorer.clear();
    });

    this.recordingController.onTranscriptionCompleted(async (text) => {
      const outcome = await this.focusRestorer.restore();
      if (outcome !== 'self_focus') {
        void this.clipboard.execute(text);
      } else {
        // moVoice was frontmost when recording started -- the text cannot be
        // pasted immediately. Copy it to the clipboard as an instant fallback
        // and watch for focus to move to an external app, then auto-paste.
        this.clipboard.copyOnly(text);
        this.focusRestorer.watchAndPaste(async () => {
          void this.clipboard.execute(text);
        });
      }
    });

    this.recordingController.onPartialTranscription(async (text) => {
      if (!streamingFocusRestored) {
        streamingFocusRestored = true;
        await this.focusRestorer.restore();
      }
      void this.clipboard.execute(text);
    });
  }

  private registerShortcut(): void {
    const { shortcutKey } = this.settings.get();
    this.shortcutManager.register(shortcutKey, () => {
      if (this.recordingController.getState() !== 'idle') {
        this.recordingController.toggle();
        return;
      }
      void this.readiness.isReady().then(async (ready) => {
        if (!ready) {
          this.welcomeWindow.show();
        } else {
          // Snapshot the frontmost app before the recording window appears so
          // that the focus target is captured while it still holds focus.
          await this.focusRestorer.capture();
          this.recordingController.toggle();
        }
      });
    });
  }
}
