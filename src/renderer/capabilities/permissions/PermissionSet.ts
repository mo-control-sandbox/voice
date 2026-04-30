import { PermissionStatus, PermissionType, type PermissionStatusProto } from '../../gen/permissions';

/**
 * Required permission types for MoVoice recording and text insertion workflows.
 */
export const REQUIRED_PERMISSION_TYPES = [
  PermissionType.PERMISSION_TYPE_MICROPHONE,
  PermissionType.PERMISSION_TYPE_ACCESSIBILITY,
] as const;

/**
 * Poll interval for permission status checks in renderer workflows.
 */
export const PERMISSION_POLL_INTERVAL_MS = 500;

/**
 * Timeout used by settings permission polling that waits for System Settings updates.
 */
export const SETTINGS_PERMISSION_POLL_TIMEOUT_MS = 30_000;

/**
 * Represents the current permissions state used by renderer workflows.
 *
 * Owns permission status lookups and required-permission checks for onboarding
 * and settings flows.
 */
export class PermissionSet {
  private constructor(private readonly permissions: readonly PermissionStatusProto[]) {}

  /**
   * Creates a permission set from proto permission entries.
   */
  static fromProto(permissions: readonly PermissionStatusProto[]): PermissionSet {
    return new PermissionSet(permissions);
  }

  /**
   * Returns the current microphone permission status.
   */
  getMic(): PermissionStatus {
    return this.getStatusByType(PermissionType.PERMISSION_TYPE_MICROPHONE);
  }

  /**
   * Returns the current accessibility permission status.
   */
  getAccessibility(): PermissionStatus {
    return this.getStatusByType(PermissionType.PERMISSION_TYPE_ACCESSIBILITY);
  }

  /**
   * Returns true when the given permission is currently granted.
   */
  isGranted(type: PermissionType): boolean {
    return this.getStatusByType(type) === PermissionStatus.PERMISSION_STATUS_GRANTED;
  }

  /**
   * Returns the current status for the given permission type.
   */
  private getStatusByType(type: PermissionType): PermissionStatus {
    const permission = this.permissions.find((entry) => entry.type === type);
    return permission?.status ?? PermissionStatus.PERMISSION_STATUS_UNSPECIFIED;
  }

  /**
   * Returns true when at least one required permission is not granted.
   */
  hasMissingPermissions(
    types: readonly PermissionType[] = REQUIRED_PERMISSION_TYPES,
  ): boolean {
    return types.some((type) => !this.isGranted(type));
  }

  /**
   * Returns only entries that belong to the required permissions set.
   */
  getRequiredPermissionEntries(): PermissionStatusProto[] {
    return this.permissions.filter((permission) => (
      REQUIRED_PERMISSION_TYPES.some((requiredType) => requiredType === permission.type)
    ));
  }
}
