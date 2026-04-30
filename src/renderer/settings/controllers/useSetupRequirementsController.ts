import { useCallback, useEffect, useState } from 'react';
import { PermissionStatus } from '../../gen/permissions';
import { getRendererModelRepository } from '../../services/getRendererModelRepository';
import { PermissionSet } from '../../infra/permissions/PermissionSet';
import { PollingLoop } from '../../infra/ipc/PollingLoop';
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
      const permissionSet = PermissionSet.fromProto(permissionsResponse.permissions);
      const microphoneStatus = permissionSet.getMic();
      const accessibilityStatus = permissionSet.getAccessibility();
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
    void refresh();
    const pollingLoop = new PollingLoop({
      intervalMs: REFRESH_INTERVAL_MS,
      tick: async () => {
        await refresh();
        return false;
      },
    });
    pollingLoop.start();
    return () => {
      pollingLoop.stop();
    };
  }, [refresh]);

  return state;
}
