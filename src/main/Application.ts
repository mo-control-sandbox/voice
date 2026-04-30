import { native } from './gen/native';
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
import { SettingsWindow } from './settings/SettingsWindow';
import { HistoryWindow } from './sessions/HistoryWindow';
import { AboutWindow } from './AboutWindow';
import { WelcomeWindow } from './welcome/WelcomeWindow';
import { ReadinessCoordinator } from './readiness/ReadinessCoordinator';
import { registerPermissionsIpc } from './system/PermissionsService';
import { registerRecordingIpc } from './recording/RecordingSessionController';
import { registerReverseIpcBridge } from './ipc/ReverseIpcBridge';
import { registerSettingsIpc } from './settings/SettingsStore';
import { registerStatsIpc } from './settings/StatsCalculator';
import { registerHistoryIpc } from './sessions/History';
import { registerDesktopIpc } from './system/DesktopService';
import { WindowPermissionPolicy } from './windowing/WindowPermissionPolicy';

/**
 * The application entry point.
 */
export class Application {
  private readonly settings = new SettingsStore();
  private readonly sessionStorage = new SessionStorage();
  private readonly historyStore = new History(this.sessionStorage);
  private readonly windowPermissionPolicy = new WindowPermissionPolicy();
  private readonly readiness = new ReadinessCoordinator(this.settings, native.systemPermissions);

  private readonly recordingController = new RecordingSessionController(
    this.settings,
    this.historyStore,
    this.sessionStorage,
    this.readiness,
    () => { this.openSetupWindow(); },
  );

  private readonly recordingWorkerWindow = new RecordingWorkerWindow(this.windowPermissionPolicy);
  private readonly overlayWindow = new OverlayWindow();
  private readonly dockManager = new DockManager();
  private readonly settingsWindow = new SettingsWindow(this.dockManager, this.windowPermissionPolicy);
  private readonly historyWindow = new HistoryWindow(this.dockManager);
  private readonly aboutWindow = new AboutWindow(this.dockManager);
  private readonly welcomeWindow = new WelcomeWindow(this.dockManager, this.windowPermissionPolicy);
  private readonly shortcutManager = new ShortcutManager();
  private readonly clipboard = new Clipboard();
  private readonly trayController = new TrayController(
    this.recordingController,
    this.settings,
    this.settingsWindow,
    this.historyWindow,
    this.aboutWindow,
  );

  /**
   * Initialises all services in the correct order and shows the tray.
   */
  async initialize(): Promise<void> {
    await this.historyStore.initialize();
    this.recordingWorkerWindow.initialize();
    let initialReadinessHandled = false;
    this.readiness.onChange((state) => {
      const isReady = state.modelReady && state.microphoneGranted && state.accessibilityGranted;
      this.trayController.setReadiness(isReady);
      this.trayController.refresh();
      if (!initialReadinessHandled) {
        initialReadinessHandled = true;
        if (!isReady && !this.settings.hasCompletedOnboarding()) {
          this.welcomeWindow.show();
        }
      }
    });

    this.trayController.initialize();

    this.dockManager.initialize(true);
    this.registerShortcut();

    registerDesktopIpc();
    registerPermissionsIpc(native.systemPermissions, () => {
      void this.readiness.recompute();
    });
    registerReverseIpcBridge(this.recordingController, this.historyStore);
    registerRecordingIpc(this.recordingController);
    registerSettingsIpc(this.settings, this.shortcutManager, () => {
      void this.readiness.recompute();
    });
    registerStatsIpc(this.historyStore);
    registerHistoryIpc(this.historyStore, this.sessionStorage);

    this.overlayWindow.initialize();
    await this.readiness.recompute();

    this.recordingController.onStateChange((status) => {
      this.overlayWindow.update(status);
      this.trayController.refresh();
    });
    this.recordingController.onTranscribed((text) => {
      void this.clipboard.pasteText(text);
    });
    this.recordingController.onPartiallyTranscribed((text) => {
      void this.clipboard.pasteText(text);
    });
    this.recordingController.onSessionAborted(() => {
      this.clipboard.cancelPending();
    });
    this.settings.onShortcutKeyChanged(() => { this.trayController.refresh(); });
  }

  private registerShortcut(): void {
    const { shortcutKey } = this.settings.get();
    this.shortcutManager.register(shortcutKey, () => {
      const state = this.recordingController.getState();
      if (state === 'recording') {
        this.recordingController.stop();
        return;
      }
      if (state === 'processing') {
        this.recordingController.cancel();
        return;
      }
      void this.recordingController.start();
    });
  }

  private openSetupWindow(): void {
    if (!this.settings.hasCompletedOnboarding()) {
      this.welcomeWindow.show();
      return;
    }
    this.settingsWindow.show();
  }
}
