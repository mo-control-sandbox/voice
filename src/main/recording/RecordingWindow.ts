import { app, BrowserWindow } from '@mobrowser/api';
import type { RecordingSessionController } from './RecordingSessionController';

const RECORDING_WINDOW_WIDTH = 320;
const RECORDING_WINDOW_HEIGHT = 88;
// Dock inset: typical macOS Dock height. No runtime Screen API is available;
// this constant provides a reasonable bottom-center position.
const DOCK_INSET_PX = 80;

/**
 * The the floating recording overlay window.
 */
export class RecordingWindow {
  private window: BrowserWindow | null = null;

  constructor(private readonly controller: RecordingSessionController) {}

  /**
   * Creates the window and begins listening for recording state changes.
   */
  initialize(): void {
    this.window = this.createWindow();
    this.controller.onStateChange((state) => {
      switch (state) {
        case 'recording':
          this.show();
          break;
        case 'idle':
          this.hide();
          break;
        case 'processing':
          // No-op.
          break;
      }
    });
  }

  private createWindow(): BrowserWindow {
    const win = new BrowserWindow({
      size: { width: RECORDING_WINDOW_WIDTH, height: RECORDING_WINDOW_HEIGHT },
      resizable: false,
      isTransparent: true,
      alwaysOnTop: true,
      windowTitleVisible: false,
      windowTitlebarVisible: false,
      windowAnimationEnabled: false,
      activationIndependenceEnabled: true,
      //windowDisplayPolicy: 'appearOnAllDesktops',
    });
    win.browser.loadUrl(new URL('recording/index.html', app.url).href);
    
    win.setWindowButtonVisible('close', false);
    win.setWindowButtonVisible('minimize', false);
    win.setWindowButtonVisible('zoom', false);
    this.position(win);
    return win;
  }

  private show(): void {
    if (this.window === null) return;
    this.position(this.window);
    this.window.show();
  }

  private hide(): void {
    this.window?.hide();
  }

  /**
   * Positions the window at the bottom-center of the primary display.
   */
  private position(win: BrowserWindow): void {
    win.centerWindow();
    const pos = win.position;
    const approxBottomY = pos.y * 2 + RECORDING_WINDOW_HEIGHT;
    win.setPosition({ x: pos.x, y: approxBottomY - RECORDING_WINDOW_HEIGHT - DOCK_INSET_PX });
  }
}
