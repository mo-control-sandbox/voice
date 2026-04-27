import { clipboard } from '@mobrowser/api';
import { native } from '../gen/native';
import { PermissionStatus, PermissionType } from '../gen/native/permissions';

/**
 * Writes transcribed text to the clipboard and, when the Accessibility
 * permission allows it, synthesises Cmd+V into the current frontmost app.
 *
 * The clipboard write always happens so the user can paste manually even if
 * automatic paste is unavailable.
 */
export class Clipboard {
  private accessibilityGranted: boolean | null = null;
  private queue: Promise<void> = Promise.resolve();

  /**
   * Writes text to the clipboard and synthesises Cmd+V if Accessibility is granted.
   *
   * Calls are serialised so that rapid partial-result pastes do not race:
   * each Paste completes before the next clipboard write begins.
   */
  execute(text: string): Promise<void> {
    this.queue = this.queue.then(() => this.doExecute(text));
    return this.queue;
  }

  /**
   * Writes text to the clipboard without synthesising a paste keystroke.
   */
  copyOnly(text: string): void {
    clipboard.write('text/plain', text);
  }

  /**
   * Clears the cached accessibility status so the next execute() re-checks.
   * Call this when the user may have changed the permission.
   */
  invalidateAccessibilityCache(): void {
    this.accessibilityGranted = null;
  }

  private async doExecute(text: string): Promise<void> {
    clipboard.write('text/plain', text);

    this.accessibilityGranted ??= await this.isAccessibilityGranted();

    if (!this.accessibilityGranted) {
      console.warn('[Clipboard] Accessibility permission not granted -- text placed on clipboard only.');
      return;
    }

    await native.automation.Paste({});
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async isAccessibilityGranted(): Promise<boolean> {
    const status = await native.systemPermissions.GetPermissionsStatus({});
    const entry = status.permissions.find((p) => p.type === PermissionType.PERMISSION_TYPE_ACCESSIBILITY);
    return entry?.status === PermissionStatus.PERMISSION_STATUS_GRANTED;
  }
}
