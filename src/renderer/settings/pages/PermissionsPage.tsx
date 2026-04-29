import { Mic, Keyboard, Loader2, type LucideIcon } from 'lucide-react';
import { PermissionType } from '../../gen/permissions';
import { PermissionRow, type PermissionMeta } from '../components/PermissionRow';
import { usePermissionsController } from '../controllers/usePermissionsController';
import './PermissionsPage.css';

interface PermissionsPageProps {
  readonly needsMicrophonePermission: boolean;
  readonly needsAccessibilityPermission: boolean;
}

const PERMISSION_META: Partial<Record<PermissionType, PermissionMeta>> = {
  [PermissionType.PERMISSION_TYPE_MICROPHONE]: {
    label: 'Microphone',
    description: 'Allow microphone access so MoVoice can capture your voice.',
    icon: Mic,
  },
  [PermissionType.PERMISSION_TYPE_ACCESSIBILITY]: {
    label: 'Accessibility',
    description: 'Allow Accessibility so MoVoice can paste text into other apps.',
    icon: Keyboard,
  },
};

const FALLBACK_META: PermissionMeta = {
  label: 'Unknown',
  description: '',
  icon: Keyboard as LucideIcon,
};

/**
 * Permissions settings page -- macOS permission statuses with explicit request and refresh actions.
 */
export function PermissionsPage(props: PermissionsPageProps): React.JSX.Element {
  const { needsMicrophonePermission, needsAccessibilityPermission } = props;
  const {
    loading,
    visiblePermissions,
    requestingPermission,
    handlePermissionAction,
  } = usePermissionsController();

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
            macOS permissions required for MoVoice to record your voice and paste text into other apps.
          </p>
          {(needsMicrophonePermission || needsAccessibilityPermission) && (
            <p className="permissions-page__setup-hint">
              {needsMicrophonePermission && needsAccessibilityPermission
                ? 'Please grant Microphone and Accessibility permissions to start recording.'
                : (needsMicrophonePermission
                  ? 'Please grant Microphone permission to start recording.'
                  : 'Please grant Accessibility permission to paste transcriptions into other apps.')}
            </p>
          )}
        </div>
      </div>

      <div className="permissions-page__list">
        {visiblePermissions.map((permission) => (
          <PermissionRow
            key={permission.type}
            permission={permission}
            meta={PERMISSION_META[permission.type] ?? FALLBACK_META}
            isRequesting={requestingPermission === permission.type}
            onAction={() => {
              void handlePermissionAction(permission);
            }}
          />
        ))}
      </div>
    </div>
  );
}
