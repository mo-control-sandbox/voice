import { native } from '../gen/native';
import type { AppSnapshot } from '../gen/native/frontmost_app';

/** Result of a restore() call. */
export type RestoreOutcome = 'restored' | 'self_focus' | 'no_snapshot';

/*
 * Captures the frontmost application before the recording overlay appears and
 * restores it before pasting, so the transcribed text lands in the app the
 * user was working in rather than in moVoice itself.
 *
 * When the snapshot targets moVoice itself, the class polls for focus to move
 * to an external app and then invokes the caller-supplied paste callback so
 * the buffered text is not lost.
 */
export class FocusRestorer {
  private snapshot: AppSnapshot | null = null;
  private watchTimer: ReturnType<typeof setInterval> | null = null;

  // Polling constants for the self-focus watch path.
  private static readonly WATCH_INTERVAL_MS = 500;
  private static readonly WATCH_TIMEOUT_MS = 60_000;

  /*
   * Records which app is currently frontmost. Must be called before the
   * recording window is shown; otherwise the overlay may already hold focus.
   */
  async capture(): Promise<void> {
    try {
      this.snapshot = await native.frontmostApp.SnapshotFrontmostApp({});
    } catch {
      this.snapshot = null;
    }
  }

  /*
   * Reactivates the previously snapshotted app and waits for it to become the
   * key window before the caller proceeds to paste.
   *
   * Returns 'restored' when focus was successfully transferred to an external
   * app. Returns 'self_focus' when the snapshot targets moVoice -- the caller
   * should buffer the text and call watchAndPaste(). Returns 'no_snapshot'
   * when capture() was not called or failed.
   */
  async restore(): Promise<RestoreOutcome> {
    const snapshot = this.snapshot;
    if (!snapshot?.bundleId) return 'no_snapshot';
    if (snapshot.appName === 'moVoice') return 'self_focus';

    try {
      await native.frontmostApp.RestoreFrontmostApp(snapshot);
      // Allow the target app to become the key window before CGEvents arrive.
      await new Promise<void>((r) => setTimeout(r, 50));
    } catch {
      // Restoration is best-effort; paste proceeds regardless.
    }
    return 'restored';
  }

  /*
   * Polls until a non-moVoice app becomes frontmost, then invokes onReady so
   * the caller can paste the buffered text into it. Any previous pending watch
   * is cancelled before the new one starts (newest wins).
   *
   * The watch expires after WATCH_TIMEOUT_MS to avoid leaking the timer
   * indefinitely when the user never returns to an external app.
   */
  watchAndPaste(onReady: () => Promise<void>): void {
    this.stopWatching();

    const deadline = Date.now() + FocusRestorer.WATCH_TIMEOUT_MS;

    this.watchTimer = setInterval(() => {
      if (Date.now() >= deadline) {
        this.stopWatching();
        return;
      }

      void (async () => {
        try {
          const current = await native.frontmostApp.SnapshotFrontmostApp({});
          if (current.appName !== 'moVoice' && current.bundleId) {
            this.stopWatching();
            await onReady();
          }
        } catch {
          // Ignore transient RPC errors; keep watching.
        }
      })();
    }, FocusRestorer.WATCH_INTERVAL_MS);
  }

  /*
   * Discards the stored snapshot and cancels any active watch. Call on cancel
   * or after paste completes.
   */
  clear(): void {
    this.snapshot = null;
    this.stopWatching();
  }

  private stopWatching(): void {
    if (this.watchTimer !== null) {
      clearInterval(this.watchTimer);
      this.watchTimer = null;
    }
  }
}
