import { globalShortcut } from '@mobrowser/api';

/**
 * Manages registration of the global recording shortcut.
 */
export class ShortcutManager {
  private currentShortcut: string | null = null;
  private currentCallback: (() => void) | null = null;
  private paused = false;

  /**
   * Registers the shortcut and the callback to be invoked on this shortcut.
   */
  register(shortcut: string, onToggle: () => void): void {
    if (this.currentShortcut !== null) {
      globalShortcut.unregister(this.currentShortcut);
    }
    this.currentShortcut = shortcut;
    this.currentCallback = onToggle;
    if (!this.paused) {
      globalShortcut.register(shortcut, onToggle);
    }
  }

  /**
   * Unregisters the currently active shortcut if one is registered.
   */
  unregister(): void {
    if (this.currentShortcut !== null) {
      globalShortcut.unregister(this.currentShortcut);
      this.currentShortcut = null;
      this.currentCallback = null;
    }
  }

  /**
   * Replaces the registered shortcut key, reusing the existing callback.
   */
  updateKey(shortcut: string): void {
    if (this.currentCallback !== null) {
      this.register(shortcut, this.currentCallback);
    }
  }

  /**
   * Temporarily unregisters the OS-level shortcut hook without forgetting the
   * current shortcut configuration.
   */
  pause(): void {
    if (!this.paused && this.currentShortcut !== null) {
      globalShortcut.unregister(this.currentShortcut);
    }
    this.paused = true;
  }

  /**
   * Re-registers the OS-level shortcut hook after a pause().
   * No-op if not currently paused.
   */
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    if (this.currentShortcut !== null && this.currentCallback !== null) {
      globalShortcut.register(this.currentShortcut, this.currentCallback);
    }
  }
}
