import { SettingsStore } from './settings/SettingsStore';
import { ShortcutManager } from './system/ShortcutManager';
import { DockManager } from './system/DockManager';
import { SessionStorage } from './sessions/SessionStorage';
import { History } from './sessions/History';
import { Clipboard } from './system/Clipboard';
import { RecordingSessionController } from './recording/RecordingSessionController';
import { TrayController } from './TrayController';
import { RecordingWorkerWindow } from './recording/RecordingWorkerWindow';
import { OverlayWindow } from './recording/OverlayWindow';
import { ApplicationWindow } from './settings/ApplicationWindow';
import { WelcomeWindow } from './welcome/WelcomeWindow';
import { MainMenu } from './system/MainMenu';
import { ReadinessCoordinator } from './readiness/ReadinessCoordinator';
import { Permissions, registerPermissionsIpc } from './system/Permissions';
import { registerRecordingIpc } from './recording/RecordingSessionController';
import { registerReverseIpcBridge } from './ipc/ReverseIpcBridge';
import { registerSettingsIpc } from './settings/SettingsStore';
import { registerStatsIpc } from './settings/StatsCalculator';
import { registerHistoryIpc } from './sessions/History';
import { registerDesktopIpc } from './system/DesktopService';
import { registerApplicationMetadataIpc } from './system/ApplicationMetadataService';

/**
 * The application entry point.
 */
export class Application {
  private readonly settings = new SettingsStore();
  private readonly sessionStorage = new SessionStorage();
  private readonly historyStore = new History(this.sessionStorage);
  private readonly permissions = new Permissions();
  private readonly readiness = new ReadinessCoordinator(this.settings, this.permissions);

  private readonly recordingController = new RecordingSessionController(
    this.settings,
    this.historyStore,
    this.sessionStorage,
    this.readiness,
    () => { this.openSetupWindow(); },
  );

  private readonly recordingWorkerWindow = new RecordingWorkerWindow();
  private readonly overlayWindow = new OverlayWindow();
  private readonly dockManager = new DockManager();
  private readonly applicationWindow = new ApplicationWindow(this.dockManager);
  private readonly welcomeWindow = new WelcomeWindow(this.dockManager);
  private readonly mainMenu = new MainMenu(this.applicationWindow);
  private readonly shortcutManager = new ShortcutManager();
  private readonly clipboard = new Clipboard();
  private readonly trayController = new TrayController(
    this.recordingController,
    this.settings,
    this.readiness,
    this.applicationWindow,
    this.welcomeWindow
  );

  /**
   * Initialises all services in the correct order and shows the tray.
   */
  async initialize(): Promise<void> {
    await this.historyStore.initialize();
    this.recordingWorkerWindow.initialize();
    this.mainMenu.create();
    let initialWelcomeAutoShowHandled = false;
    this.readiness.onChange((isReady) => {
      if (!initialWelcomeAutoShowHandled) {
        initialWelcomeAutoShowHandled = true;
        if (!isReady && !this.settings.hasCompletedOnboarding()) {
          this.welcomeWindow.show();
        }
      }
    });

    this.trayController.refresh();

    this.dockManager.initialize();
    const { shortcutKey } = this.settings.get();
    this.shortcutManager.register(shortcutKey, () => {
      this.recordingController.handleShortcutTrigger();
    });

    registerApplicationMetadataIpc();
    registerDesktopIpc();
    registerPermissionsIpc(this.permissions, () => {
      void this.readiness.recompute();
    });
    registerReverseIpcBridge(this.recordingController, this.historyStore);
    registerRecordingIpc(this.recordingController);
    registerSettingsIpc(this.settings, this.shortcutManager, () => {
      void this.readiness.recompute();
    });
    registerStatsIpc(this.historyStore);
    registerHistoryIpc(this.historyStore, this.sessionStorage);

    await this.readiness.recompute();
    this.showInitialWindowIfNeeded();

    this.recordingController.onStateChange((status) => {
      this.overlayWindow.update(status);
      this.trayController.refresh();
    });
    this.recordingController.onTranscribed((text) => {
      this.clipboard.pasteText(text);
    });
    this.recordingController.onPartiallyTranscribed((text) => {
      this.clipboard.queueStreamingText(text);
    });
    this.recordingController.onSessionAborted(() => {
      this.clipboard.cancelPending();
    });
    this.settings.onShortcutKeyChanged(() => { this.trayController.refresh(); });
  }

  /**
   * Shows the appropriate startup window based on onboarding and launch preferences.
   */
  private showInitialWindowIfNeeded(): void {
    if (!this.settings.hasCompletedOnboarding()) return;

    const { showWindowOnAppLaunch } = this.settings.get();
    if (showWindowOnAppLaunch) {
      this.applicationWindow.show();
    }
  }

  /**
   * Opens onboarding when incomplete, otherwise opens the main application window.
   */
  private openSetupWindow(): void {
    if (!this.settings.hasCompletedOnboarding()) {
      this.welcomeWindow.show();
      return;
    }
    this.applicationWindow.show();
  }
}
