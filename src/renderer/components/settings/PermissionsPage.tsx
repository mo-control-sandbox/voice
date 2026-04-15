import type { JSX } from 'react';
import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { PermissionStatusProto } from '@/gen/permissions';
import { ipc } from '@/gen/ipc';
import { Button } from '@/components/ui/button';
import { PermissionRow } from './PermissionRow';

interface PermissionsPageProps {
  readonly permissions: PermissionStatusProto[]
  readonly onRefreshed: (permissions: PermissionStatusProto[]) => void
}

/**
 * Displays all macOS permissions required by the application with their
 * current grant status and actions to open System Settings.
 */
export function PermissionsPage({ permissions, onRefreshed }: PermissionsPageProps): JSX.Element {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = (): void => {
    setRefreshing(true);
    ipc.permissions.RefreshPermissions({})
      .then((response) => { onRefreshed(response.permissions); })
      .catch((err: unknown) => { console.error('[PermissionsPage] Refresh error:', err); })
      .finally(() => { setRefreshing(false); });
  };

  const handleOpenSettings = (type: string): void => {
    void ipc.permissions.OpenSystemSettings({ type });
  };

  const handleRequest = (type: string): void => {
    ipc.permissions.RequestPermission({ type })
      .then((response) => { onRefreshed(response.permissions); })
      .catch((err: unknown) => { console.error('[PermissionsPage] RequestPermission error:', err); });
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Permissions</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            macOS permissions required by moVoice
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card px-4">
        {permissions.map((permission) => (
          <PermissionRow
            key={permission.type}
            permission={permission}
            onOpenSettings={handleOpenSettings}
            onRequest={handleRequest}
          />
        ))}
      </div>
    </div>
  );
}
