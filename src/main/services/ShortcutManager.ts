import { globalShortcut } from '@mobrowser/api';
import type { RecordingSessionController } from '../domain/RecordingSessionController';

/** Modifier-only key names that cannot form a valid standalone shortcut. */
const MODIFIER_NAMES = new Set([
  'Meta', 'Shift', 'Alt', 'Control', 'Command', 'Option', 'Super', 'CommandOrControl',
]);

/** Returns true when every `+`-separated token is a modifier name. */
function isModifierOnly(shortcut: string): boolean {
  return shortcut.split('+').every(part => MODIFIER_NAMES.has(part.trim()));
}

/**
 * Registers and manages a single global keyboard shortcut that drives the
 * recording FSM in toggle mode: one press starts recording, a second press
 * stops it. No-op while processing (spec §2.2 — shortcut during processing
 * is explicitly ignored).
 */
export class ShortcutManager {
  private currentShortcut: string | null = null;

  constructor(private readonly controller: RecordingSessionController) {}

  /**
   * Register `shortcut` and wire it to the recording controller.
   * Returns `false` if the shortcut is invalid or rejected by the OS.
   */
  register(shortcut: string): boolean {
    if (isModifierOnly(shortcut)) {
      console.warn(`[ShortcutManager] Refusing modifier-only shortcut: "${shortcut}"`);
      return false;
    }
    try {
      const ok = globalShortcut.register(shortcut, () => {
        const state = this.controller.getState();
        if (state === 'idle') {
          void this.controller.start();
        } else if (state === 'recording') {
          this.controller.stop();
        }
        // 'processing' → no-op per §2.2
      });
      if (!ok) {
        console.warn(`[ShortcutManager] OS rejected shortcut: "${shortcut}"`);
        return false;
      }
      this.currentShortcut = shortcut;
      return true;
    } catch (err) {
      console.warn(`[ShortcutManager] Failed to register shortcut "${shortcut}":`, err);
      return false;
    }
  }

  /** Unregister the currently registered shortcut, if any. */
  unregister(): void {
    if (this.currentShortcut !== null) {
      globalShortcut.unregister(this.currentShortcut);
      this.currentShortcut = null;
    }
  }

  /** Replace the active shortcut with a new one atomically. */
  update(shortcut: string): void {
    this.unregister();
    this.register(shortcut);
  }
}
