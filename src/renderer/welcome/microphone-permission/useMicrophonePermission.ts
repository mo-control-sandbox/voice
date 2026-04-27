import { useState } from 'react';
import { PermissionStatus, PermissionType } from '../../gen/permissions';
import { getPermissionStatus } from '../../capabilities/permissions/permissionSnapshot';
import { PermissionsService } from '../../settings/services/PermissionsService';
import type { WizardEventType } from '../flow';
import type { FeedbackState } from '../shared/feedback';

const permissionsService = new PermissionsService();

/**
 * Owns microphone permission state and request flow for onboarding.
 */
export function useMicrophonePermission(params: {
  readonly clearAutoAdvance: () => void;
  readonly scheduleAutoAdvance: (eventType: WizardEventType) => void;
}): {
  readonly microphoneStatus: PermissionStatus;
  readonly microphoneFeedback: FeedbackState;
  readonly refreshPermissionStatuses: () => Promise<{
    readonly microphoneStatus: PermissionStatus;
    readonly accessibilityStatus: PermissionStatus;
  }>;
  readonly handleRequestMicrophonePermission: () => Promise<{
    readonly microphoneStatus: PermissionStatus;
    readonly accessibilityStatus: PermissionStatus | null;
  }>;
} {
  const { clearAutoAdvance, scheduleAutoAdvance } = params;
  const [microphoneStatus, setMicrophoneStatus] = useState<PermissionStatus>(
    PermissionStatus.PERMISSION_STATUS_UNSPECIFIED,
  );
  const [microphoneFeedback, setMicrophoneFeedback] = useState<FeedbackState>('idle');

  async function refreshPermissionStatuses(): Promise<{
    readonly microphoneStatus: PermissionStatus;
    readonly accessibilityStatus: PermissionStatus;
  }> {
    const response = await permissionsService.refreshPermissions();
    const latestMicrophoneStatus = getPermissionStatus(
      response.permissions,
      PermissionType.PERMISSION_TYPE_MICROPHONE,
    );
    const latestAccessibilityStatus = getPermissionStatus(
      response.permissions,
      PermissionType.PERMISSION_TYPE_ACCESSIBILITY,
    );

    setMicrophoneStatus(latestMicrophoneStatus);
    return {
      microphoneStatus: latestMicrophoneStatus,
      accessibilityStatus: latestAccessibilityStatus,
    };
  }

  async function handleRequestMicrophonePermission(): Promise<{
    readonly microphoneStatus: PermissionStatus;
    readonly accessibilityStatus: PermissionStatus | null;
  }> {
    setMicrophoneFeedback('loading');
    clearAutoAdvance();

    try {
      await permissionsService.requestPermission(PermissionType.PERMISSION_TYPE_MICROPHONE);
      const latestStatuses = await refreshPermissionStatuses();

      if (latestStatuses.microphoneStatus === PermissionStatus.PERMISSION_STATUS_GRANTED) {
        setMicrophoneFeedback('success');
        scheduleAutoAdvance('MIC_GRANTED');
      } else {
        setMicrophoneFeedback('info');
      }

      return latestStatuses;
    } catch {
      setMicrophoneFeedback('info');
      return {
        microphoneStatus,
        accessibilityStatus: null,
      };
    }
  }

  return {
    microphoneStatus,
    microphoneFeedback,
    refreshPermissionStatuses,
    handleRequestMicrophonePermission,
  };
}
