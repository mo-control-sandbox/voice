import { app, type PermissionName, type PermissionStatus as AppPermissionStatus } from '@mobrowser/api';
import { PermissionStatus, PermissionType, type PermissionStatusProto } from '../gen/permissions';

/**
 * Translates MoVoice permission types to MōBrowser application permissions.
 */
export class AppPermissionsBackend {
  /**
   * Returns the current status snapshot for permissions required by the application.
   */
  getPermissionsStatus(): PermissionStatusProto[] {
    return [
      this.getPermissionStatus(PermissionType.PERMISSION_TYPE_MICROPHONE),
      this.getPermissionStatus(PermissionType.PERMISSION_TYPE_ACCESSIBILITY),
    ];
  }

  /**
   * Returns the current status for one permission type.
   */
  getPermissionStatus(type: PermissionType): PermissionStatusProto {
    const name = toAppPermissionName(type);
    if (name === null) {
      return { type, status: PermissionStatus.PERMISSION_STATUS_DENIED };
    }

    return {
      type,
      status: toPermissionStatus(app.permissions.getStatus(name)),
    };
  }

  /**
   * Requests a permission from the operating system.
   */
  async requestPermission(type: PermissionType): Promise<void> {
    const name = toAppPermissionName(type);
    if (name === null) return;
    await app.permissions.request(name);
  }

  /**
   * Opens the operating system settings pane for a permission.
   */
  openSystemSettings(type: PermissionType): void {
    const name = toAppPermissionName(type);
    if (name === null) return;
    app.permissions.openSystemSettings(name);
  }
}

function toAppPermissionName(type: PermissionType): PermissionName | null {
  if (type === PermissionType.PERMISSION_TYPE_MICROPHONE) return 'microphone';
  if (type === PermissionType.PERMISSION_TYPE_ACCESSIBILITY) return 'accessibility';
  return null;
}

function toPermissionStatus(status: AppPermissionStatus): PermissionStatus {
  if (status === 'granted') return PermissionStatus.PERMISSION_STATUS_GRANTED;
  if (status === 'notDetermined') return PermissionStatus.PERMISSION_STATUS_NOT_DETERMINED;
  return PermissionStatus.PERMISSION_STATUS_DENIED;
}
