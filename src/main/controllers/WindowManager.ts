import { BrowserWindow } from '@mobrowser/api';

const RECORDING_WIN_WIDTH = 480;
const RECORDING_WIN_HEIGHT = 100;
const SETTINGS_WIN_WIDTH = 900;
const SETTINGS_WIN_HEIGHT = 620;
const HISTORY_WIN_WIDTH = 800;
const HISTORY_WIN_HEIGHT = 560;
/** Approximate height of the macOS Dock at default size. */
const DOCK_HEIGHT_APPROX = 70;
const MARGIN = 16;

/**
 * Owns all application window instances and controls their visibility.
 *
 * Lifecycle per window type:
 * - Recording: created eagerly in constructor, kept alive, shown/hidden on demand.
 * - Settings, History: created lazily on first `show*` call; hidden (not destroyed)
 *   on close so that re-opening is fast and stateless navigation works.
 * - About: created fresh on each `showAbout()` call, destroyed when closed.
 */
export class WindowManager {
  private readonly recordingWin: BrowserWindow;
  private settingsWin: BrowserWindow | null = null;
  private historyWin: BrowserWindow | null = null;

  private readonly recordingWindowClosedCallbacks: Array<() => void> = [];

  constructor(private readonly appUrl: string) {
    this.recordingWin = new BrowserWindow();
    this.recordingWin.setWindowTitlebarVisible(false);
    this.recordingWin.setWindowTitleVisible(false);
    this.recordingWin.setAlwaysOnTop(true);
    this.recordingWin.setSize({ width: RECORDING_WIN_WIDTH, height: RECORDING_WIN_HEIGHT });
    this.recordingWin.browser.loadUrl(this.appUrl + '#recording');
    this.positionRecordingWindow();

    // Fire registered callbacks if the recording window is ever destroyed
    // (edge case: OS force-close). Treat as implicit cancel.
    this.recordingWin.on('closed', () => {
      for (const cb of this.recordingWindowClosedCallbacks) {
        cb();
      }
    });
  }

  /** Show the recording window, re-computing its position first. */
  showRecordingWindow(): void {
    this.positionRecordingWindow();
    this.recordingWin.show();
  }

  /**
   * Signal that the recording window should transition to the processing state.
   * The recording window polls `RecordingService.GetStatus()` at 30 fps and
   * reacts to the `processing` state itself — no additional push is required.
   */
  transitionRecordingWindowToProcessing(): void {
    // The renderer detects the state change via polling; no direct signal needed.
  }

  /** Hide the recording window without destroying it. */
  hideRecordingWindow(): void {
    if (!this.recordingWin.isClosed) {
      this.recordingWin.hide();
    }
  }

  /**
   * Show the Settings window, navigating to the optional `page` sub-route.
   * Created on first call; subsequent calls show/bring-to-front the existing window.
   */
  showSettings(page?: string): void {
    const hash = '#settings' + (page != null ? `/${page}` : '');
    if (this.settingsWin === null) {
      this.settingsWin = this.createPersistentWindow(hash, SETTINGS_WIN_WIDTH, SETTINGS_WIN_HEIGHT);
    } else {
      // `show()` brings the window to the front whether visible or hidden.
      this.settingsWin.browser.loadUrl(this.appUrl + hash);
      this.settingsWin.show();
    }
  }

  /** Show the History window. Created on first call; re-shown on subsequent calls. */
  showHistory(): void {
    if (this.historyWin === null) {
      this.historyWin = this.createPersistentWindow('#history', HISTORY_WIN_WIDTH, HISTORY_WIN_HEIGHT);
    } else {
      this.historyWin.show();
    }
  }

  /** Show the About window. A fresh window is created on each call and destroyed on close. */
  showAbout(): void {
    const aboutWin = new BrowserWindow();
    aboutWin.browser.loadUrl(this.appUrl + '#about');
    aboutWin.show();
    // Destroyed automatically when the user closes it.
  }

  /**
   * Register a callback to be invoked if the recording window is ever closed
   * without an explicit cancel from the UI (e.g. OS force-close). The composition
   * root uses this to call `RecordingSessionController.cancel()`.
   */
  onRecordingWindowClosed(callback: () => void): void {
    this.recordingWindowClosedCallbacks.push(callback);
  }

  /**
   * Create a persistent `BrowserWindow` that hides instead of destroying on close.
   * Settings and History windows use this lifecycle.
   */
  private createPersistentWindow(hash: string, width: number, height: number): BrowserWindow {
    const win = new BrowserWindow({ size: { width, height } });
    win.browser.loadUrl(this.appUrl + hash);
    win.browser.handle('close', async () => {
      win.hide();
      return 'cancel' as const;
    });
    win.show();
    return win;
  }

  /**
   * Derive the primary screen dimensions via `centerWindow()` (no MōBrowser screen
   * API exists), then position the recording window at the bottom centre above the Dock.
   */
  private positionRecordingWindow(): void {
    // Center the window temporarily to read the screen-center coordinates,
    // from which we can back-compute the full screen dimensions.
    this.recordingWin.centerWindow();
    const center = this.recordingWin.position;
    const screenWidth = 2 * center.x + RECORDING_WIN_WIDTH;
    const screenHeight = 2 * center.y + RECORDING_WIN_HEIGHT;

    const x = Math.round((screenWidth - RECORDING_WIN_WIDTH) / 2);
    const y = screenHeight - DOCK_HEIGHT_APPROX - RECORDING_WIN_HEIGHT - MARGIN;
    this.recordingWin.setPosition({ x, y });
  }
}
