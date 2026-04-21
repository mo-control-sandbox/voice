import { PermissionStatus, type PermissionStatusProto } from '../../gen/permissions';
import './PermissionRow.css';

/** Display metadata for a single permission entry — provided by the caller. */
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

type BadgeStatus = 'granted' | 'denied' | 'unknown';

function resolveBadge(status: PermissionStatus): { label: string; status: BadgeStatus } {
  switch (status) {
    case PermissionStatus.PERMISSION_STATUS_GRANTED:
      return { label: 'Granted', status: 'granted' };
    case PermissionStatus.PERMISSION_STATUS_DENIED:
      return { label: 'Denied', status: 'denied' };
    default:
      return { label: 'Not requested', status: 'unknown' };
  }
}

const descriptionId = (label: string): string =>
  `permission-desc-${label.toLowerCase().replace(/\s+/g, '-')}`;

/** One row in the Permissions page — icon, name/description, status badge, optional action. */
export function PermissionRow({ permission, meta, onRequest }: PermissionRowProps): React.JSX.Element {
  const Icon = meta.icon;
  const badge = resolveBadge(permission.status);
  const isGranted = permission.status === PermissionStatus.PERMISSION_STATUS_GRANTED;
  const descId = descriptionId(meta.label);

  return (
    <div className="permission-row">
      {/* Icon */}
      <div className="permission-row__icon-wrap" aria-hidden="true">
        <Icon className="permission-row__icon" />
      </div>

      {/* Name + description */}
      <div className="permission-row__text">
        <span className="permission-row__name">{meta.label}</span>
        <span id={descId} className="permission-row__description">{meta.description}</span>
      </div>

      {/* Status badge */}
      <span
        className="permission-row__badge"
        data-status={badge.status}
        aria-label={`${meta.label}: ${badge.label}`}
      >
        {badge.label}
      </span>

      {/* Request / Open Settings — only when not yet granted */}
      {!isGranted && (
        <button
          className="permission-row__action"
          onClick={onRequest}
          aria-describedby={descId}
        >
          {permission.status === PermissionStatus.PERMISSION_STATUS_DENIED
            ? 'Open Settings'
            : 'Request'}
        </button>
      )}
    </div>
  );
}
