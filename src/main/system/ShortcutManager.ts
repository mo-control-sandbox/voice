import { globalShortcut } from '@mobrowser/api';

/**
 * Describes a global shortcut binding and its action.
 */
type Shortcut = {
  /**
   * The key combination string used for OS-level registration.
   */
  readonly combination: string;
  /**
   * Handler invoked when the shortcut is triggered.
   */
  readonly handler: () => void;
};

/**
 * Owns the lifecycle of the application recording shortcut in the OS registry.
 */
export class ShortcutManager {
  /**
   * Currently configured shortcut binding.
   */
  private currentShortcut: Shortcut | null = null;

  /**
   * Indicates whether OS-level registration is temporarily suspended.
   */
  private paused = false;

  /**
   * Registers the given binding and replaces any previous one.
   */
  register(combination: string, handler: () => void): void {
    if (this.currentShortcut !== null) {
      globalShortcut.unregister(this.currentShortcut.combination);
    }
    this.currentShortcut = { combination, handler };
    if (!this.paused) {
      globalShortcut.register(combination, handler);
    }
  }

  /**
   * Removes the current binding from the OS registry and clears local state.
   */
  unregister(): void {
    if (this.currentShortcut !== null) {
      globalShortcut.unregister(this.currentShortcut.combination);
      this.currentShortcut = null;
    }
  }

  /**
   * Replaces only the shortcut combination while preserving the current handler.
   */
  updateKey(shortcut: string): void {
    if (this.currentShortcut !== null) {
      this.register(shortcut, this.currentShortcut.handler);
    }
  }

  /**
   * Suspends OS-level shortcut activation without discarding the binding.
   */
  pause(): void {
    if (!this.paused && this.currentShortcut !== null) {
      globalShortcut.unregister(this.currentShortcut.combination);
    }
    this.paused = true;
  }

  /**
   * Restores OS-level activation for the current binding when previously paused.
   */
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    if (this.currentShortcut !== null) {
      globalShortcut.register(this.currentShortcut.combination, this.currentShortcut.handler);
    }
  }
}
