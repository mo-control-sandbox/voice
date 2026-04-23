import { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, Keyboard, RotateCcw, Loader2 } from 'lucide-react';
import { PermissionStatus, PermissionType, type PermissionStatusProto } from '../../gen/permissions';
import { PermissionRow, type PermissionMeta } from '../components/PermissionRow';
import { PermissionsService } from '../services/PermissionsService';
import './PermissionsPage.css';

const permissionsService = new PermissionsService();

const REQUIRED_PERMISSION_TYPES = new Set<PermissionType>([
  PermissionType.PERMISSION_TYPE_MICROPHONE,
  PermissionType.PERMISSION_TYPE_ACCESSIBILITY,
]);

function hasMissingRequiredPermissions(permissions: readonly PermissionStatusProto[]): boolean {
  return [...REQUIRED_PERMISSION_TYPES].some((type) => {
    const permission = permissions.find((entry) => entry.type === type);
    return permission?.status !== PermissionStatus.PERMISSION_STATUS_GRANTED;
  });
}

const PERMISSION_META: Partial<Record<PermissionType, PermissionMeta>> = {
  [PermissionType.PERMISSION_TYPE_MICROPHONE]: {
    label: 'Microphone',
    description: 'Allow microphone access so moVoice can capture your voice.',
    icon: Mic,
  },
  [PermissionType.PERMISSION_TYPE_ACCESSIBILITY]: {
    label: 'Accessibility',
    description: 'Allow Accessibility so moVoice can paste text into other apps.',
    icon: Keyboard,
  },
};

const FALLBACK_META: PermissionMeta = {
  label: 'Unknown',
  description: '',
  icon: Keyboard,
};

const PERMISSION_POLL_INTERVAL_MS = 500;
const PERMISSION_POLL_TIMEOUT_MS = 30_000;

/**
 * Permissions settings page -- macOS permission statuses with explicit request and refresh actions.
 */
export function PermissionsPage(): React.JSX.Element {
  const [permissions, setPermissions] = useState<PermissionStatusProto[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
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
    setRefreshing(true);

    let pollInFlight = false;

    const runPoll = async (): Promise<void> => {
      if (pollInFlight) return;

      pollInFlight = true;
      try {
        const latestPermissions = await refreshPermissionsSnapshot();
        if (!hasMissingRequiredPermissions(latestPermissions)) {
          clearPermissionPolling();
          setRefreshing(false);
        }
      } finally {
        pollInFlight = false;
      }
    };

    void runPoll();
    pollIntervalRef.current = setInterval(() => { void runPoll(); }, PERMISSION_POLL_INTERVAL_MS);
    pollTimeoutRef.current = setTimeout(() => {
      clearPermissionPolling();
      setRefreshing(false);
    }, PERMISSION_POLL_TIMEOUT_MS);
  }, [clearPermissionPolling, refreshPermissionsSnapshot]);

  useEffect(() => {
    void loadPermissions().finally(() => { setLoading(false); });
  }, [loadPermissions]);

  useEffect(() => {
    return () => {
      clearPermissionPolling();
    };
  }, [clearPermissionPolling]);

  async function handleRefresh(): Promise<void> {
    clearPermissionPolling();
    setRefreshing(true);
    try {
      await refreshPermissionsSnapshot();
    } finally {
      setRefreshing(false);
    }
  }

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

  if (loading) {
    return (
      <div className="permissions-page">
        <div className="permissions-page__loading">
          <Loader2 className="permissions-page__loading-icon" aria-label="Loading" />
        </div>
      </div>
    );
  }

  const visiblePermissions = permissions.filter((permission) => (
    REQUIRED_PERMISSION_TYPES.has(permission.type)
  ));
  return (
    <div className="permissions-page">
      <div className="permissions-page__header">
        <div className="permissions-page__title-block">
          <h1 className="permissions-page__heading">Before You Start</h1>
          <p className="permissions-page__description">
            Before using the application, complete this quick setup so moVoice can record and paste for you.
          </p>
        </div>
        <button
          type="button"
          className="permissions-page__refresh"
          disabled={refreshing}
          onClick={() => { void handleRefresh(); }}
        >
          <RotateCcw className="permissions-page__refresh-icon" aria-hidden="true" />
          Check again
        </button>
      </div>

      <div className="permissions-page__list">
        {visiblePermissions.map((permission) => (
          <PermissionRow
            key={permission.type}
            permission={permission}
            meta={PERMISSION_META[permission.type] ?? FALLBACK_META}
            isRequesting={requestingPermission === permission.type}
            onAction={() => { void handlePermissionAction(permission); }}
          />
        ))}
      </div>
    </div>
  );
}
