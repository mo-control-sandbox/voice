import { PermissionStatus, type PermissionStatusProto, type PermissionType } from '../../gen/permissions';
import { REQUIRED_PERMISSION_TYPES } from './constants';

/**
 * Returns the requested permission status from a permissions snapshot.
 */
export function getPermissionStatus(
  permissions: readonly PermissionStatusProto[],
  type: PermissionType,
): PermissionStatus {
  const permission = permissions.find((entry) => entry.type === type);
  return permission?.status ?? PermissionStatus.PERMISSION_STATUS_UNSPECIFIED;
}

/**
 * Returns true when any required permission is not granted.
 */
export function hasMissingPermissions(
  permissions: readonly PermissionStatusProto[],
  types: readonly PermissionType[] = REQUIRED_PERMISSION_TYPES,
): boolean {
  return types.some((type) => (
    getPermissionStatus(permissions, type) !== PermissionStatus.PERMISSION_STATUS_GRANTED
  ));
}
