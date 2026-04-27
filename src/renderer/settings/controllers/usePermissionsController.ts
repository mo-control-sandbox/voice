import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionStatus, PermissionType, type PermissionStatusProto } from '../../gen/permissions';
import { PermissionsService } from '../services/PermissionsService';

const PERMISSION_POLL_INTERVAL_MS = 500;
const PERMISSION_POLL_TIMEOUT_MS = 30_000;

const REQUIRED_PERMISSION_TYPES = new Set<PermissionType>([
  PermissionType.PERMISSION_TYPE_MICROPHONE,
  PermissionType.PERMISSION_TYPE_ACCESSIBILITY,
]);

const permissionsService = new PermissionsService();

function hasMissingRequiredPermissions(permissions: readonly PermissionStatusProto[]): boolean {
  return [...REQUIRED_PERMISSION_TYPES].some((type) => {
    const permission = permissions.find((entry) => entry.type === type);
    return permission?.status !== PermissionStatus.PERMISSION_STATUS_GRANTED;
  });
}

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
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPermissions = useCallback(async (): Promise<void> => {
    const response = await permissionsService.getPermissions();
    setPermissions(response.permissions);
  }, []);

  const clearPermissionPolling = useCallback((): void => {
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    if (pollTimeoutRef.current !== null) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  const refreshPermissionsSnapshot = useCallback(async (): Promise<PermissionStatusProto[]> => {
    const response = await permissionsService.refreshPermissions();
    setPermissions(response.permissions);
    return response.permissions;
  }, []);

  const startPermissionPolling = useCallback((): void => {
    clearPermissionPolling();

    let pollInFlight = false;

    const runPoll = async (): Promise<void> => {
      if (pollInFlight) return;

      pollInFlight = true;
      try {
        const latestPermissions = await refreshPermissionsSnapshot();
        if (!hasMissingRequiredPermissions(latestPermissions)) {
          clearPermissionPolling();
        }
      } finally {
        pollInFlight = false;
      }
    };

    void runPoll();
    pollIntervalRef.current = setInterval(() => {
      void runPoll();
    }, PERMISSION_POLL_INTERVAL_MS);
    pollTimeoutRef.current = setTimeout(() => {
      clearPermissionPolling();
    }, PERMISSION_POLL_TIMEOUT_MS);
  }, [clearPermissionPolling, refreshPermissionsSnapshot]);

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
    REQUIRED_PERMISSION_TYPES.has(permission.type)
  ));

  return {
    loading,
    visiblePermissions,
    requestingPermission,
    handlePermissionAction,
  };
}
