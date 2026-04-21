import { useState, useEffect, useCallback } from 'react';
import { Mic, Keyboard, BrainCircuit, RefreshCw } from 'lucide-react';
import { PermissionType, type PermissionStatusProto } from '../../gen/permissions';
import { PermissionRow, type PermissionMeta } from '../components/PermissionRow';
import { PermissionsService } from '../services/PermissionsService';
import './PermissionsPage.css';

const permissionsService = new PermissionsService();

/**
 * moVoice-specific display metadata for each required permission.
 * Lives here — labels, descriptions, and icons are domain knowledge of this
 * application, not the generic PermissionRow component.
 */
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

/** Permissions settings page — shows macOS permission statuses with request actions. */
export function PermissionsPage(): React.JSX.Element {
  const [permissions, setPermissions] = useState<PermissionStatusProto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  return (
    <div className="permissions-page">
      <div className="permissions-page__header">
        <div className="permissions-page__title-block">
          <h2 className="permissions-page__heading">Permissions</h2>
          <p className="permissions-page__description">
            macOS permissions required by moVoice.
          </p>
        </div>

        <button
          className="permissions-page__refresh"
          onClick={() => { void handleRefresh(); }}
          disabled={refreshing}
          aria-label="Refresh permission statuses"
        >
          <RefreshCw
            className="permissions-page__refresh-icon"
            data-spinning={refreshing ? 'true' : undefined}
            aria-hidden="true"
          />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="permissions-page__loading" aria-busy="true" aria-label="Loading permissions">
          <RefreshCw className="permissions-page__loading-icon" aria-hidden="true" />
        </div>
      ) : (
        <div className="permissions-page__list" role="list">
          {permissions.map((permission) => (
            <div key={permission.type} role="listitem">
              <PermissionRow
                permission={permission}
                meta={PERMISSION_META[permission.type] ?? FALLBACK_META}
                onRequest={() => { void handleRequest(permission.type); }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
