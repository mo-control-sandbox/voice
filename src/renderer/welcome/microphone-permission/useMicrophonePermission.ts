import { useState } from 'react';
import { PermissionStatus, PermissionType } from '../../gen/permissions';
import { PermissionsService } from '../../settings/services/PermissionsService';
import type { WizardEventType } from '../flow';
import type { FeedbackState } from '../shared/feedback';
import { readRequiredPermissions } from '../shared/readRequiredPermissions';

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
  readonly setMicrophoneStatus: (status: PermissionStatus) => void;
  readonly refreshMicrophoneStatus: () => Promise<PermissionStatus>;
  readonly handleRequestMicrophonePermission: () => Promise<PermissionStatus>;
} {
  const { clearAutoAdvance, scheduleAutoAdvance } = params;
  const [microphoneStatus, setMicrophoneStatus] = useState<PermissionStatus>(
    PermissionStatus.PERMISSION_STATUS_UNSPECIFIED,
  );
  const [microphoneFeedback, setMicrophoneFeedback] = useState<FeedbackState>('idle');

  async function refreshMicrophoneStatus(): Promise<PermissionStatus> {
    const { microphoneStatus: latestMicrophoneStatus } = await readRequiredPermissions();
    setMicrophoneStatus(latestMicrophoneStatus);
    return latestMicrophoneStatus;
  }

  async function handleRequestMicrophonePermission(): Promise<PermissionStatus> {
    setMicrophoneFeedback('loading');
    clearAutoAdvance();

    try {
      await permissionsService.requestPermission(PermissionType.PERMISSION_TYPE_MICROPHONE);
      const latestMicrophoneStatus = await refreshMicrophoneStatus();

      if (latestMicrophoneStatus === PermissionStatus.PERMISSION_STATUS_GRANTED) {
        setMicrophoneFeedback('success');
        scheduleAutoAdvance('MIC_GRANTED');
      } else {
        setMicrophoneFeedback('info');
      }

      return latestMicrophoneStatus;
    } catch {
      setMicrophoneFeedback('info');
      return microphoneStatus;
    }
  }

  return {
    microphoneStatus,
    microphoneFeedback,
    setMicrophoneStatus,
    refreshMicrophoneStatus,
    handleRequestMicrophonePermission,
  };
}
