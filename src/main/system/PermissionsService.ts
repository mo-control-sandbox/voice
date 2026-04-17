import { ipc } from '@mobrowser/api';
import type { SystemPermissionsService } from '../gen/native/permissions';
import { PermissionsService as createPermissionsService, type PermissionsService as PermissionsServiceInterface } from '../gen/ipc_service';
import type { PermissionTypeRequest } from '../gen/permissions';

/**
 * Registers the Permissions IPC service in the main process, delegating all
 * permission queries and actions to the native module.
 */
export function registerPermissionsIpc(
  systemPermissions: SystemPermissionsService,
): void {
  ipc.registerService(createPermissionsService(new PermissionsService(systemPermissions)));
}

class PermissionsService implements PermissionsServiceInterface {
  constructor(private readonly systemPermissions: SystemPermissionsService) {}

  /**
   * Returns the current macOS authorisation status for all required permissions.
   */
  async GetPermissions() {
    const result = await this.systemPermissions.GetPermissionsStatus({});
    return { permissions: result.permissions };
  }

  /**
   * Opens the appropriate System Settings privacy pane for the given permission type.
   */
  async OpenSystemSettings(request: PermissionTypeRequest) {
    await this.systemPermissions.OpenSystemSettings({ type: request.type });
    return {};
  }

  /**
   * Re-queries all permissions and returns a fresh snapshot.
   */
  async RefreshPermissions() {
    const result = await this.systemPermissions.GetPermissionsStatus({});
    return { permissions: result.permissions };
  }

  /**
   * Triggers the OS permission prompt; for already-denied permissions opens System Settings.
   */
  async RequestPermission(request: PermissionTypeRequest) {
    await this.systemPermissions.RequestPermission({ type: request.type });
    return {};
  }
}
