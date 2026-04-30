import type { PermissionStatus } from '../../gen/permissions';
import { PermissionSet } from '../../infra/permissions/PermissionSet';
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
  const permissionSet = PermissionSet.fromProto(response.permissions);
  return {
    microphoneStatus: permissionSet.getMic(),
    accessibilityStatus: permissionSet.getAccessibility(),
  };
}
