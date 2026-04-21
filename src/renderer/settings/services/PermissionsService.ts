import { ipc } from '../../gen/ipc';
import type { PermissionType } from '../../gen/permissions';

/**
 * IPC adapter for the permissions domain.
 *
 * Wraps permission queries and request actions so that the permissions page
 * component does not depend on the IPC module directly.
 */
export class PermissionsService {
  /** Returns the current status of all macOS permissions required by moVoice. */
  async getPermissions() {
    return ipc.permissions.GetPermissions({});
  }

  /** Re-queries the OS for the latest permission statuses. */
  async refreshPermissions() {
    return ipc.permissions.RefreshPermissions({});
  }

  /** Triggers the macOS permission request dialog for the given permission type. */
  async requestPermission(type: PermissionType): Promise<void> {
    await ipc.permissions.RequestPermission({ type });
  }
}
