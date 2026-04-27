import { PermissionStatus, type PermissionStatusProto, type PermissionType } from '../../gen/permissions';

/**
 * Returns the requested permission status from a permissions snapshot.
 */
export function findPermissionStatus(
  permissions: readonly PermissionStatusProto[],
  type: PermissionType,
): PermissionStatus {
  const permission = permissions.find((entry) => entry.type === type);
  return permission?.status ?? PermissionStatus.PERMISSION_STATUS_UNSPECIFIED;
}
