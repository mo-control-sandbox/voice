import { PermissionStatus, PermissionType } from '../gen/permissions';
import type { SystemPermissionsService } from '../gen/native/permissions';
import type { SettingsStore } from '../settings/SettingsStore';

const REQUIRED_PERMISSION_TYPES = [
  PermissionType.PERMISSION_TYPE_MICROPHONE,
  PermissionType.PERMISSION_TYPE_ACCESSIBILITY,
] as const;

/**
 * Checks whether the application is ready to record by querying live state:
 * the renderer-reported model flag from persistent storage and the current
 * macOS permission statuses from the native layer.
 */
export class AppReadinessService {
  constructor(
    private readonly settings: SettingsStore,
    private readonly systemPermissions: SystemPermissionsService,
  ) {}

  /**
   * Returns true when a downloaded model is active and all required permissions
   * are granted. Queries the native permission layer on every call.
   */
  async isReady(): Promise<boolean> {
    if (!this.settings.isModelReady()) return false;
    const result = await this.systemPermissions.GetPermissionsStatus({});
    const grantedStatus = PermissionStatus.PERMISSION_STATUS_GRANTED as number;
    return REQUIRED_PERMISSION_TYPES.every((type) => {
      const requiredType = type as number;
      const perm = result.permissions.find((p) => (p.type as number) === requiredType);
      return (perm?.status as number | undefined) === grantedStatus;
    });
  }
}
