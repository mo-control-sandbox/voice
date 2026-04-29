import { PermissionType } from '../../gen/permissions';
import type { PermissionStatus } from '../../gen/permissions';
import { getPermissionStatus } from '../../capabilities/permissions/permissionSnapshot';
import { PermissionsService } from '../../settings/services/PermissionsService';

const permissionsService = new PermissionsService();

export interface RequiredPermissionsSnapshot {
  readonly microphoneStatus: PermissionStatus;
  readonly accessibilityStatus: PermissionStatus;
}

/**
 * Reads the latest required permission statuses from the main-process snapshot.
 */
export async function readRequiredPermissions(): Promise<RequiredPermissionsSnapshot> {
  const response = await permissionsService.refreshPermissions();
  return {
    microphoneStatus: getPermissionStatus(
      response.permissions,
      PermissionType.PERMISSION_TYPE_MICROPHONE,
    ),
    accessibilityStatus: getPermissionStatus(
      response.permissions,
      PermissionType.PERMISSION_TYPE_ACCESSIBILITY,
    ),
  };
}
