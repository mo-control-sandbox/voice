import { clipboard } from '@mobrowser/api';
import type { CapturedApp, PasteResult } from '../../shared/types';
import type { native as NativeBindings } from '../gen/native';
import type { PasteCoordinator as IPasteCoordinator } from '../domain/RecordingSessionController';

/**
 * Implements `PasteCoordinator`: writes the transcribed text to the clipboard,
 * then activates the target application and synthesises Cmd+V via the native
 * module. All OS-level errors are surfaced as typed `PasteResult` failures
 * rather than thrown exceptions.
 */
export class PasteCoordinator implements IPasteCoordinator {
  constructor(
    private readonly native: typeof NativeBindings,
    /** Bundle ID of the moVoice process itself, used to prevent self-paste. */
    private readonly ownBundleId: string,
  ) {}

  /** Write `text` to the clipboard and paste it into `target`. */
  async paste(text: string, target: CapturedApp): Promise<PasteResult> {
    // Write to clipboard before any permission check so that the text is
    // available even if we cannot activate the target (the user can paste
    // manually). This matches the behaviour described in §6.2.
    clipboard.write('text/plain', text);

    if (target.bundleId === this.ownBundleId) {
      return { success: false, reason: 'selfTarget' };
    }

    const permissionsResponse = await this.native.systemPermissions.GetPermissionsStatus({});
    const accessibility = permissionsResponse.permissions.find(
      p => p.type === 'accessibility',
    );
    if (accessibility?.status !== 'granted') {
      return { success: false, reason: 'accessibilityDenied' };
    }

    const result = await this.native.paste.ActivateAndPaste({ bundleId: target.bundleId });
    if (!result.success) {
      return { success: false, reason: 'appGone' };
    }

    return { success: true };
  }
}
