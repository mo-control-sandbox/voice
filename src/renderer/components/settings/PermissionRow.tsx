import type { JSX } from 'react';
import { Mic, Languages, MousePointer2 } from 'lucide-react';
import type { PermissionStatusProto } from '@/gen/permissions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PermissionRowProps {
  readonly permission: PermissionStatusProto
  readonly onOpenSettings: (type: string) => void
  readonly onRequest: (type: string) => void
}

function permissionIcon(type: string): JSX.Element {
  switch (type) {
    case 'microphone':       return <Mic className="w-5 h-5" />;
    case 'speechRecognition': return <Languages className="w-5 h-5" />;
    case 'accessibility':    return <MousePointer2 className="w-5 h-5" />;
    default:                 return <Mic className="w-5 h-5" />;
  }
}

/** Returns Tailwind classes for the colour-coded status pill. */
function statusClass(status: string): string {
  switch (status) {
    case 'granted':        return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
    case 'denied':         return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
    case 'notDetermined':  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
    default:               return 'bg-muted text-muted-foreground';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'granted':       return 'Granted';
    case 'denied':        return 'Denied';
    case 'notDetermined': return 'Not determined';
    default:              return status;
  }
}

/**
 * Displays a single macOS permission with its icon, description,
 * colour-coded status, and an optional "Open in System Settings" button.
 */
export function PermissionRow({ permission, onOpenSettings, onRequest }: PermissionRowProps): JSX.Element {
  return (
    <div className="flex items-start gap-4 py-4 border-b border-border last:border-0">
      <div className="flex-shrink-0 mt-0.5 text-muted-foreground">
        {permissionIcon(permission.type)}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground">{permission.description}</p>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-medium', statusClass(permission.status))}>
          {statusLabel(permission.status)}
        </span>

        {permission.status === 'notDetermined' && permission.type !== 'accessibility' && (
          <Button
            variant="default"
            size="sm"
            onClick={() => { onRequest(permission.type); }}
          >
            Request
          </Button>
        )}

        {(permission.status === 'denied' || (permission.status === 'notDetermined' && permission.type === 'accessibility')) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { onOpenSettings(permission.type); }}
          >
            Open in System Settings
          </Button>
        )}
      </div>
    </div>
  );
}
