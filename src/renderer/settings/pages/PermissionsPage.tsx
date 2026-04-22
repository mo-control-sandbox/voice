import { useState, useEffect, useCallback } from 'react';
import { Mic, Keyboard, BrainCircuit, RotateCcw, Loader2 } from 'lucide-react';
import { PermissionType, type PermissionStatusProto } from '../../gen/permissions';
import { PermissionRow, type PermissionMeta } from '../components/PermissionRow';
import { PermissionsService } from '../services/PermissionsService';
import './PermissionsPage.css';

const permissionsService = new PermissionsService();

const PERMISSION_META: Partial<Record<PermissionType, PermissionMeta>> = {
  [PermissionType.PERMISSION_TYPE_MICROPHONE]: {
    label: 'Microphone',
    description: 'Required to record your voice for transcription.',
    icon: Mic,
  },
  [PermissionType.PERMISSION_TYPE_SPEECH_RECOGNITION]: {
    label: 'Speech Recognition',
    description: 'Required for on-device transcription using built-in macOS speech recognition.',
    icon: BrainCircuit,
  },
  [PermissionType.PERMISSION_TYPE_ACCESSIBILITY]: {
    label: 'Accessibility',
    description: 'Required to simulate Cmd+V and paste text into other applications.',
    icon: Keyboard,
  },
};

const FALLBACK_META: PermissionMeta = {
  label: 'Unknown',
  description: '',
  icon: Keyboard,
};

/** Permissions settings page -- macOS permission statuses with request and refresh actions. */
export function PermissionsPage(): React.JSX.Element {
  const [permissions, setPermissions] = useState<PermissionStatusProto[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);

  const loadPermissions = useCallback(async (): Promise<void> => {
    const response = await permissionsService.getPermissions();
    setPermissions(response.permissions);
  }, []);

  useEffect(() => {
    void loadPermissions().finally(() => { setLoading(false); });
  }, [loadPermissions]);

  async function handleRefresh(): Promise<void> {
    setRefreshing(true);
    try {
      const response = await permissionsService.refreshPermissions();
      setPermissions(response.permissions);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleRequest(type: PermissionType): Promise<void> {
    await permissionsService.requestPermission(type);
    const response = await permissionsService.refreshPermissions();
    setPermissions(response.permissions);
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

  return (
    <div className="permissions-page">
      <div className="permissions-page__header">
        <div className="permissions-page__title-block">
          <h1 className="permissions-page__heading">Permissions</h1>
          <p className="permissions-page__description">
            moVoice requires the following macOS permissions to function.
          </p>
        </div>
        <button
          type="button"
          className="permissions-page__refresh"
          disabled={refreshing}
          onClick={() => { void handleRefresh(); }}
        >
          <RotateCcw
            className="permissions-page__refresh-icon"
            data-spinning={refreshing ? 'true' : undefined}
            aria-hidden="true"
          />
          {refreshing ? 'Checking...' : 'Refresh'}
        </button>
      </div>

      <div className="permissions-page__list">
        {permissions.map((permission) => (
          <PermissionRow
            key={permission.type}
            permission={permission}
            meta={PERMISSION_META[permission.type] ?? FALLBACK_META}
            onRequest={() => { void handleRequest(permission.type); }}
          />
        ))}
      </div>
    </div>
  );
}
