import { useEffect, useState } from 'react';
import { hasMissingPermissions } from '../../capabilities/permissions/permissionSnapshot';
import { PermissionsService } from '../services/PermissionsService';

export type SettingsPageId = 'dashboard' | 'general' | 'models' | 'permissions';

const permissionsService = new PermissionsService();

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
        setActivePage(hasMissingPermissions(response.permissions) ? 'permissions' : 'dashboard');
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
