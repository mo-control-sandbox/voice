import { useCallback, useEffect, useState } from 'react';
import { PermissionStatus, type PermissionStatusProto, type PermissionType } from '../../gen/permissions';
import {
  REQUIRED_PERMISSION_TYPES,
  PERMISSION_POLL_INTERVAL_MS,
  SETTINGS_PERMISSION_POLL_TIMEOUT_MS,
} from '../../capabilities/permissions/constants';
import { hasMissingPermissions } from '../../capabilities/permissions/permissionSnapshot';
import { usePermissionPolling } from '../../capabilities/permissions/usePermissionPolling';
import { PermissionsService } from '../services/PermissionsService';

const permissionsService = new PermissionsService();

/**
 * Owns permission loading, refresh, request, and polling workflows for settings.
 */
export function usePermissionsController(): {
  readonly loading: boolean;
  readonly visiblePermissions: PermissionStatusProto[];
  readonly requestingPermission: PermissionType | null;
  readonly handlePermissionAction: (permission: PermissionStatusProto) => Promise<void>;
} {
  const [permissions, setPermissions] = useState<PermissionStatusProto[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestingPermission, setRequestingPermission] = useState<PermissionType | null>(null);

  const loadPermissions = useCallback(async (): Promise<void> => {
    const response = await permissionsService.getPermissions();
    setPermissions(response.permissions);
  }, []);

  const refreshPermissionsSnapshot = useCallback(async (): Promise<PermissionStatusProto[]> => {
    const response = await permissionsService.refreshPermissions();
    setPermissions(response.permissions);
    return response.permissions;
  }, []);

  const {
    startPolling: startPermissionPolling,
    stopPolling: clearPermissionPolling,
  } = usePermissionPolling({
    intervalMs: PERMISSION_POLL_INTERVAL_MS,
    timeoutMs: SETTINGS_PERMISSION_POLL_TIMEOUT_MS,
    poll: async (): Promise<boolean> => {
      const latestPermissions = await refreshPermissionsSnapshot();
      return !hasMissingPermissions(latestPermissions);
    },
  });

  useEffect(() => {
    void loadPermissions().finally(() => {
      setLoading(false);
    });
  }, [loadPermissions]);

  useEffect(() => {
    return () => {
      clearPermissionPolling();
    };
  }, [clearPermissionPolling]);

  async function handlePermissionAction(permission: PermissionStatusProto): Promise<void> {
    setRequestingPermission(permission.type);
    try {
      if (permission.status === PermissionStatus.PERMISSION_STATUS_DENIED) {
        await permissionsService.openSystemSettings(permission.type);
        startPermissionPolling();
      } else {
        await permissionsService.requestPermission(permission.type);
        await refreshPermissionsSnapshot();
      }
    } finally {
      setRequestingPermission(null);
    }
  }

  const visiblePermissions = permissions.filter((permission) => (
    REQUIRED_PERMISSION_TYPES.some((requiredType) => requiredType === permission.type)
  ));

  return {
    loading,
    visiblePermissions,
    requestingPermission,
    handlePermissionAction,
  };
}
