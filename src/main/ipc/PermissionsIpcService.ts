import type { PermissionsService } from '../gen/ipc_service';
import type { PermissionsResponse, PermissionTypeRequest } from '../gen/permissions';
import type { Empty } from '../gen/google/protobuf/empty';
import type { native as NativeBindings } from '../gen/native';

/** Human-readable descriptions for each macOS permission required by moVoice. */
const DESCRIPTIONS: Record<string, string> = {
  microphone: 'Required to capture audio during recording.',
  speechRecognition: 'Required to use Apple\'s on-device speech recognition engine.',
  accessibility: 'Required to paste transcribed text into the frontmost application.',
};

/**
 * IPC service that surfaces macOS permission statuses to the renderer
 * and allows the user to open the relevant System Settings pane.
 */
export class PermissionsIpcService implements PermissionsService {
  constructor(private readonly native: typeof NativeBindings) {}

  async GetPermissions(_request: Empty): Promise<PermissionsResponse> {
    return this.fetchPermissions();
  }

  async OpenSystemSettings(request: PermissionTypeRequest): Promise<Empty> {
    await this.native.systemPermissions.OpenSystemSettings({ type: request.type });
    return {};
  }

  /**
   * Triggers the macOS system permission prompt for the given type, then returns
   * the updated permission list. Accessibility cannot be requested programmatically
   * on macOS — for that type the call is a no-op and current status is returned.
   */
  async RequestPermission(request: PermissionTypeRequest): Promise<PermissionsResponse> {
    if (request.type !== 'accessibility') {
      await this.native.systemPermissions.RequestPermission({ type: request.type });
    }
    return this.fetchPermissions();
  }

  async RefreshPermissions(_request: Empty): Promise<PermissionsResponse> {
    return this.fetchPermissions();
  }

  private async fetchPermissions(): Promise<PermissionsResponse> {
    const result = await this.native.systemPermissions.GetPermissionsStatus({});
    const permissions = result.permissions.map(p => ({
      type: p.type,
      status: p.status,
      description: DESCRIPTIONS[p.type] ?? '',
    }));
    return { permissions };
  }
}
