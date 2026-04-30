import { ipc } from '@mobrowser/api';
import { PermissionsService as createPermissionsService, type PermissionsService as PermissionsServiceInterface } from '../gen/ipc_service';
import type { PermissionTypeRequest } from '../gen/permissions';
import type { AppPermissionsBackend } from './AppPermissionsBackend';

/**
 * Registers the Permissions IPC service in the main process, delegating all
 * permission queries and actions to the native module.
 */
export function registerPermissionsIpc(
  permissionsBackend: AppPermissionsBackend,
  onPermissionsChanged?: () => void,
): void {
  ipc.registerService(createPermissionsService(new PermissionsService(permissionsBackend, onPermissionsChanged)));
}

class PermissionsService implements PermissionsServiceInterface {
  constructor(
    private readonly permissionsBackend: AppPermissionsBackend,
    private readonly onPermissionsChanged?: () => void,
  ) {}

  /**
   * Returns the current macOS authorisation status for all required permissions.
   */
  GetPermissions() {
    return Promise.resolve({ permissions: this.permissionsBackend.getPermissionsStatus() });
  }

  /**
   * Opens the appropriate System Settings privacy pane for the given permission type.
   */
  OpenSystemSettings(request: PermissionTypeRequest) {
    this.permissionsBackend.openSystemSettings(request.type);
    return Promise.resolve({});
  }

  /**
   * Re-queries all permissions and returns a fresh snapshot.
   */
  RefreshPermissions() {
    this.onPermissionsChanged?.();
    return Promise.resolve({ permissions: this.permissionsBackend.getPermissionsStatus() });
  }

  /**
   * Triggers the OS permission prompt; for already-denied permissions opens System Settings.
   */
  async RequestPermission(request: PermissionTypeRequest) {
    await this.permissionsBackend.requestPermission(request.type);
    this.onPermissionsChanged?.();
    return {};
  }
}
