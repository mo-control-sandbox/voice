import { PermissionStatus, type PermissionStatusProto } from '../../gen/permissions';

/** Display metadata for a single permission entry -- provided by the caller. */
export interface PermissionMeta {
  readonly label: string;
  readonly description: string;
  readonly icon: React.ComponentType<{ className?: string }>;
}

interface PermissionRowProps {
  readonly permission: PermissionStatusProto;
  readonly meta: PermissionMeta;
  readonly onRequest: () => void;
}

function statusLabel(status: PermissionStatus): string {
  switch (status) {
    case PermissionStatus.PERMISSION_STATUS_GRANTED: return 'Granted';
    case PermissionStatus.PERMISSION_STATUS_DENIED:  return 'Denied';
    default: return 'Not requested';
  }
}

/** One row in the Permissions page -- name, description, status, optional action. */
export function PermissionRow({ permission, meta, onRequest }: PermissionRowProps): React.JSX.Element {
  const isGranted = permission.status === PermissionStatus.PERMISSION_STATUS_GRANTED;
  const isDenied  = permission.status === PermissionStatus.PERMISSION_STATUS_DENIED;

  return (
    <div>
      <span>{meta.label}</span>
      <span>{meta.description}</span>
      <span>{statusLabel(permission.status)}</span>
      {!isGranted && (
        <button onClick={onRequest}>
          {isDenied ? 'Open Settings' : 'Request'}
        </button>
      )}
    </div>
  );
}
