import type { BrowserWindow, RequestPermissionsParams } from '@mobrowser/api';
import type { WindowPermissionPolicy } from './WindowPermissionPolicy';

/**
 * Connects the window permission callback to the shared permission policy.
 */
export function attachPermissionHandler(
  window: BrowserWindow,
  permissionPolicy: WindowPermissionPolicy,
): void {
  window.browser.handle('requestPermissions', (params: RequestPermissionsParams) => (
    Promise.resolve(permissionPolicy.getAction(params))
  ));
}
