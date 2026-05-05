import { useCallback, useState } from 'react';
import type { SetupRequirementsState } from './useSetupRequirementsController';

export type SettingsPageId = 'dashboard' | 'history' | 'general' | 'models' | 'permissions' | 'about';

/**
 * Owns initial settings page selection based on required permission state.
 */
export function useSettingsNavigationController(): {
  readonly activePage: SettingsPageId | null;
  readonly setActivePage: (page: SettingsPageId) => void;
} & {
  readonly setInitialPageFromRequirements: (requirements: SetupRequirementsState) => void;
} {
  const [activePage, setActivePage] = useState<SettingsPageId | null>(null);

  const setInitialPageFromRequirements = useCallback((requirements: SetupRequirementsState): void => {
    if (activePage !== null || requirements.loading) return;
    if (requirements.needsModel) {
      setActivePage('models');
      return;
    }
    if (requirements.needsMicrophonePermission || requirements.needsAccessibilityPermission) {
      setActivePage('permissions');
      return;
    }
    setActivePage('dashboard');
  }, [activePage]);

  return {
    activePage,
    setActivePage,
    setInitialPageFromRequirements,
  };
}
