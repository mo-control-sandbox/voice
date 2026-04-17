import { PermissionStatus, type PermissionStatusProto } from '../../gen/permissions';
import { cn } from '../../lib/utils';

/** Display metadata for a single permission entry — injected by the caller. */
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

const NOT_DETERMINED_BADGE = {
  label: 'Not requested',
  className: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
};

const STATUS_BADGE: Partial<Record<PermissionStatus, { label: string; className: string }>> = {
  [PermissionStatus.PERMISSION_STATUS_GRANTED]: {
    label: 'Granted',
    className: 'bg-green-500/15 text-green-400 border border-green-500/30',
  },
  [PermissionStatus.PERMISSION_STATUS_DENIED]: {
    label: 'Denied',
    className: 'bg-red-500/15 text-red-400 border border-red-500/30',
  },
  [PermissionStatus.PERMISSION_STATUS_NOT_DETERMINED]: NOT_DETERMINED_BADGE,
};

const FALLBACK_BADGE = NOT_DETERMINED_BADGE;

/** Displays a single macOS permission with its status and action buttons. */
export function PermissionRow({
  permission,
  meta,
  onRequest,
}: PermissionRowProps): React.JSX.Element {
  const badge = STATUS_BADGE[permission.status] ?? FALLBACK_BADGE;
  const Icon = meta.icon;

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
      {/* Icon */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{meta.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
      </div>

      {/* Status badge */}
      <span
        className={cn(
          'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
          badge.className,
        )}
      >
        {badge.label}
      </span>

      {/* Request button — visible when not yet granted */}
      {permission.status !== PermissionStatus.PERMISSION_STATUS_GRANTED && (
        <button
          onClick={onRequest}
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Request
        </button>
      )}
    </div>
  );
}
