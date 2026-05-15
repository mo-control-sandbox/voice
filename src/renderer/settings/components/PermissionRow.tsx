import { Loader2 } from 'lucide-react';
import { PermissionStatus, type PermissionStatusProto } from '../../gen/permissions';
import './PermissionRow.css';

/**
 * Display metadata for a single permission entry -- provided by the caller.
 */
export interface PermissionMeta {
  readonly label: string;
  readonly description: string;
  readonly icon: React.ComponentType<{ className?: string }>;
}

interface PermissionRowProps {
  readonly permission: PermissionStatusProto;
  readonly meta: PermissionMeta;
  readonly isRequesting: boolean;
  readonly onAction: () => void;
}

function statusLabel(status: PermissionStatus, isRequesting: boolean): string {
  if (isRequesting) return 'Setting up...';

  switch (status) {
    case PermissionStatus.PERMISSION_STATUS_GRANTED:        return 'Ready';
    case PermissionStatus.PERMISSION_STATUS_DENIED:         return 'Needs setup';
    case PermissionStatus.PERMISSION_STATUS_NOT_DETERMINED:
    case PermissionStatus.PERMISSION_STATUS_UNSPECIFIED:
    case PermissionStatus.UNRECOGNIZED:
    default:                                                return 'Pending';
  }
}

function statusDataAttr(status: PermissionStatus, isRequesting: boolean): string {
  if (isRequesting) return 'requesting';

  switch (status) {
    case PermissionStatus.PERMISSION_STATUS_GRANTED:        return 'granted';
    case PermissionStatus.PERMISSION_STATUS_DENIED:         return 'denied';
    case PermissionStatus.PERMISSION_STATUS_NOT_DETERMINED:
    case PermissionStatus.PERMISSION_STATUS_UNSPECIFIED:
    case PermissionStatus.UNRECOGNIZED:
    default:                                                return 'unknown';
  }
}

function actionLabel(status: PermissionStatus, isRequesting: boolean): string {
  if (isRequesting) return 'Applying...';
  return status === PermissionStatus.PERMISSION_STATUS_DENIED ? 'Open System Settings...' : 'Allow Access';
}

/**
 * One row in the Permissions page -- icon, name, description, status badge, optional action.
 */
export function PermissionRow({
  permission,
  meta,
  isRequesting,
  onAction,
}: PermissionRowProps): React.JSX.Element {
  const { icon: Icon } = meta;
  const isGranted = permission.status === PermissionStatus.PERMISSION_STATUS_GRANTED;

  return (
    <div className="permission-row">
      <div className="permission-row__icon-wrap">
        <Icon className="permission-row__icon" aria-hidden="true" />
      </div>

      <div className="permission-row__text">
        <div className="permission-row__name-wrapper">
          <span className="permission-row__name">{meta.label}</span>
          <span
              className="permission-row__badge"
              data-status={statusDataAttr(permission.status, isRequesting)}
          >
            {isRequesting && (
                <Loader2 className="permission-row__status-icon" aria-hidden="true"/>
            )}
            {statusLabel(permission.status, isRequesting)}
          </span>
        </div>
        <span className="permission-row__description">{meta.description}</span>
      </div>

      {!isGranted && (
        <button
          type="button"
          className="permission-row__action"
          disabled={isRequesting}
          onClick={onAction}
        >
          {actionLabel(permission.status, isRequesting)}
        </button>
      )}
    </div>
  );
}
