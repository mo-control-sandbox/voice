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
  /**
   * Writes text to the clipboard and synthesises Cmd+V if Accessibility is granted.
   */
  async execute(text: string): Promise<void> {
    clipboard.write('text/plain', text);

    const accessible = await this.isAccessibilityGranted();
    if (!accessible) {
      console.warn('[Clipboard] Accessibility permission not granted — text placed on clipboard only.');
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
