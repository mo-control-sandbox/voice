import { useCallback, useEffect, useState } from 'react';
import { PermissionStatus, PermissionType } from '../../gen/permissions';
import { getRendererModelRepository } from '../../services/getRendererModelRepository';
import { getPermissionStatus } from '../../capabilities/permissions/permissionSnapshot';
import { PermissionsService } from '../services/PermissionsService';

const permissionsService = new PermissionsService();
const modelRepository = getRendererModelRepository();
const REFRESH_INTERVAL_MS = 1000;

export interface SetupRequirementsState {
  readonly loading: boolean;
  readonly needsModel: boolean;
  readonly needsMicrophonePermission: boolean;
  readonly needsAccessibilityPermission: boolean;
}

/**
 * Tracks whether setup actions are still required for recording readiness.
 */
export function useSetupRequirementsController(): SetupRequirementsState {
  const [state, setState] = useState<SetupRequirementsState>({
    loading: true,
    needsModel: false,
    needsMicrophonePermission: false,
    needsAccessibilityPermission: false,
  });

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const [models, permissionsResponse] = await Promise.all([
        modelRepository.getModels(),
        permissionsService.getPermissions(),
      ]);
      const hasReadyModel = models.some((model) => model.isActive && model.isDownloaded);
      const microphoneStatus = getPermissionStatus(
        permissionsResponse.permissions,
        PermissionType.PERMISSION_TYPE_MICROPHONE,
      );
      const accessibilityStatus = getPermissionStatus(
        permissionsResponse.permissions,
        PermissionType.PERMISSION_TYPE_ACCESSIBILITY,
      );
      setState({
        loading: false,
        needsModel: !hasReadyModel,
        needsMicrophonePermission: microphoneStatus !== PermissionStatus.PERMISSION_STATUS_GRANTED,
        needsAccessibilityPermission: accessibilityStatus !== PermissionStatus.PERMISSION_STATUS_GRANTED,
      });
    } catch {
      setState((previous) => ({
        ...previous,
        loading: false,
      }));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void refresh();
    const interval = setInterval(() => {
      if (!cancelled) {
        void refresh();
      }
    }, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refresh]);

  return state;
}
