import { PermissionStatus, type PermissionStatusProto } from '../../gen/permissions';
import './PermissionRow.css';

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
    case PermissionStatus.PERMISSION_STATUS_GRANTED:        return 'Granted';
    case PermissionStatus.PERMISSION_STATUS_DENIED:         return 'Denied';
    case PermissionStatus.PERMISSION_STATUS_NOT_DETERMINED:
    case PermissionStatus.PERMISSION_STATUS_UNSPECIFIED:
    case PermissionStatus.UNRECOGNIZED:
    default:                                                return 'Not requested';
  }
}

function statusDataAttr(status: PermissionStatus): string {
  switch (status) {
    case PermissionStatus.PERMISSION_STATUS_GRANTED:        return 'granted';
    case PermissionStatus.PERMISSION_STATUS_DENIED:         return 'denied';
    case PermissionStatus.PERMISSION_STATUS_NOT_DETERMINED:
    case PermissionStatus.PERMISSION_STATUS_UNSPECIFIED:
    case PermissionStatus.UNRECOGNIZED:
    default:                                                return 'unknown';
  }
}

/** One row in the Permissions page -- icon, name, description, status badge, optional action. */
export function PermissionRow({ permission, meta, onRequest }: PermissionRowProps): React.JSX.Element {
  const { icon: Icon } = meta;
  const isGranted = permission.status === PermissionStatus.PERMISSION_STATUS_GRANTED;
  const isDenied  = permission.status === PermissionStatus.PERMISSION_STATUS_DENIED;

  return (
    <div className="permission-row">
      <div className="permission-row__icon-wrap">
        <Icon className="permission-row__icon" aria-hidden="true" />
      </div>

      <div className="permission-row__text">
        <span className="permission-row__name">{meta.label}</span>
        <span className="permission-row__description">{meta.description}</span>
      </div>

      <span
        className="permission-row__badge"
        data-status={statusDataAttr(permission.status)}
      >
        {statusLabel(permission.status)}
      </span>

      {!isGranted && (
        <button type="button" className="permission-row__action" onClick={onRequest}>
          {isDenied ? 'Open Settings' : 'Request'}
        </button>
      )}
    </div>
  );
}
