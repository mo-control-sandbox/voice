import type { RequestPermissionsAction, RequestPermissionsParams } from '@mobrowser/api';

/**
 * Encapsulates permission decisions for main-process application windows.
 */
export class WindowPermissionPolicy {
  private readonly grantedPermissionTypes = new Set(['microphone', 'AudioCapture']);

  /**
   * Returns the permission action that should be applied to the request.
   */
  getAction(params: RequestPermissionsParams): RequestPermissionsAction {
    if (this.grantedPermissionTypes.has(params.permissionType)) {
      return 'grant';
    }
    return 'deny';
  }
}
