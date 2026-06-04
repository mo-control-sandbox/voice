import {
  app,
  ipc,
  type BrowserWindow,
  type PermissionName,
  type PermissionStatus as AppPermissionStatus,
  type RequestPermissionsParams,
} from '@mobrowser/api';
import { PermissionStatus, PermissionType, type PermissionStatusProto, type PermissionTypeRequest } from '../gen/permissions';
import { PermissionsServiceDescriptor, type PermissionsService as PermissionsServiceInterface } from '../gen/ipc_service';

/**
 * Translates MōVoice permission types to MōBrowser application permissions.
 */
export class Permissions {
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

/**
 * Connects window permission requests to the shared application permission policy.
 */
export function attachPermissionHandler(window: BrowserWindow): void {
  window.browser.handle('requestPermissions', (params: RequestPermissionsParams) => Promise.resolve(
    params.permissionType === 'microphone' || params.permissionType === 'AudioCapture'
      ? 'grant'
      : 'deny',
  ));
}

/**
 * Registers the Permissions IPC service in the main process.
 */
export function registerPermissionsIpc(
  permissions: Permissions,
  onPermissionsChanged?: () => void,
): void {
  ipc.registerService(PermissionsServiceDescriptor, new IpcPermissionsService(permissions, onPermissionsChanged));
}

class IpcPermissionsService implements PermissionsServiceInterface {
  constructor(
    private readonly permissions: Permissions,
    private readonly onPermissionsChanged?: () => void,
  ) {}

  /**
   * Returns the current macOS authorisation status for all required permissions.
   */
  GetPermissions() {
    return Promise.resolve({ permissions: this.permissions.getPermissionsStatus() });
  }

  /**
   * Opens the appropriate System Settings privacy pane for the given permission type.
   */
  OpenSystemSettings(request: PermissionTypeRequest) {
    this.permissions.openSystemSettings(request.type);
    return Promise.resolve({});
  }

  /**
   * Re-queries all permissions and returns a fresh snapshot.
   */
  RefreshPermissions() {
    this.onPermissionsChanged?.();
    return Promise.resolve({ permissions: this.permissions.getPermissionsStatus() });
  }

  /**
   * Triggers the OS permission prompt; for already-denied permissions opens System Settings.
   */
  async RequestPermission(request: PermissionTypeRequest) {
    await this.permissions.requestPermission(request.type);
    this.onPermissionsChanged?.();
    return {};
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
