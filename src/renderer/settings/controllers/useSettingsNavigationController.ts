import { useEffect, useState } from 'react';
import { PermissionStatus, PermissionType, type PermissionStatusProto } from '../../gen/permissions';
import { PermissionsService } from '../services/PermissionsService';

export type SettingsPageId = 'dashboard' | 'general' | 'models' | 'permissions';

const permissionsService = new PermissionsService();

const REQUIRED_PERMISSION_TYPES = [
  PermissionType.PERMISSION_TYPE_MICROPHONE,
  PermissionType.PERMISSION_TYPE_ACCESSIBILITY,
] as const;

function hasMissingRequiredPermissions(permissions: readonly PermissionStatusProto[]): boolean {
  return REQUIRED_PERMISSION_TYPES.some((type) => {
    const permission = permissions.find((entry) => entry.type === type);
    return permission?.status !== PermissionStatus.PERMISSION_STATUS_GRANTED;
  });
}

/**
 * Owns initial settings page selection based on required permission state.
 */
export function useSettingsNavigationController(): {
  readonly activePage: SettingsPageId | null;
  readonly setActivePage: (page: SettingsPageId) => void;
} {
  const [activePage, setActivePage] = useState<SettingsPageId | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function chooseInitialPage(): Promise<void> {
      try {
        const response = await permissionsService.getPermissions();
        if (isCancelled) return;
        setActivePage(hasMissingRequiredPermissions(response.permissions) ? 'permissions' : 'dashboard');
      } catch {
        if (!isCancelled) setActivePage('dashboard');
      }
    }

    void chooseInitialPage();
    return () => {
      isCancelled = true;
    };
  }, []);

  return {
    activePage,
    setActivePage,
  };
}
