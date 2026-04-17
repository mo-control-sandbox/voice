import { useState, useEffect, useCallback } from 'react';
import { Mic, Keyboard, BrainCircuit, RefreshCw } from 'lucide-react';
import { ipc } from '../../gen/ipc';
import { PermissionType, type PermissionStatusProto } from '../../gen/permissions';
import { PermissionRow, type PermissionMeta } from '../components/PermissionRow';

/**
 * moVoice-specific display metadata for each required permission.
 * Lives here — not in the generic PermissionRow component — because
 * labels, descriptions, and icons are domain knowledge of this application.
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
    description: 'Required to simulate Cmd+V and paste text into other apps.',
    icon: Keyboard,
  },
};

/** The Permissions settings page — shows macOS permission statuses and lets users open the relevant settings panes. */
export function PermissionsPage(): React.JSX.Element {
  const [permissions, setPermissions] = useState<PermissionStatusProto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPermissions = useCallback(async (): Promise<void> => {
    const response = await ipc.permissions.GetPermissions({});
    setPermissions(response.permissions);
  }, []);

  useEffect(() => {
    void loadPermissions().finally(() => { setLoading(false); });
  }, [loadPermissions]);

  async function handleRefresh(): Promise<void> {
    setRefreshing(true);
    try {
      const response = await ipc.permissions.RefreshPermissions({});
      setPermissions(response.permissions);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleRequest(type: PermissionType): Promise<void> {
    await ipc.permissions.RequestPermission({ type });
    const response = await ipc.permissions.RefreshPermissions({});
    setPermissions(response.permissions);
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Permissions</h1>
          <p className="text-muted-foreground text-sm mt-1">
            macOS permissions required by moVoice.
          </p>
        </div>
        <button
          onClick={() => { void handleRefresh(); }}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {permissions.map((permission) => (
            <PermissionRow
              key={permission.type}
              permission={permission}
              meta={PERMISSION_META[permission.type] ?? { label: String(permission.type), description: '', icon: Keyboard }}
              onRequest={() => { void handleRequest(permission.type); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
