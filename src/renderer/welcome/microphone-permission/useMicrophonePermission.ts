import { useEffect, useRef, useState } from 'react';
import { PermissionStatus, PermissionType } from '../../gen/permissions';
import { PERMISSION_POLL_INTERVAL_MS } from '../../infra/permissions/PermissionSet';
import { usePermissionPolling } from '../../infra/permissions/usePermissionPolling';
import { PermissionsService } from '../../settings/services/PermissionsService';
import type { WizardEventType } from '../flow';
import type { FeedbackState } from '../shared/feedback';
import { readRequiredPermissions } from '../shared/readRequiredPermissions';

const permissionsService = new PermissionsService();

/**
 * Owns microphone permission state and request flow for onboarding.
 */
export function useMicrophonePermission(params: {
  readonly isStepActive: boolean;
  readonly clearAutoAdvance: () => void;
  readonly scheduleAutoAdvance: (eventType: WizardEventType) => void;
}): {
  readonly microphoneStatus: PermissionStatus;
  readonly microphoneFeedback: FeedbackState;
  readonly setMicrophoneStatus: (status: PermissionStatus) => void;
  readonly refreshMicrophoneStatus: () => Promise<PermissionStatus>;
  readonly handleRequestMicrophonePermission: () => Promise<PermissionStatus>;
} {
  const { isStepActive, clearAutoAdvance, scheduleAutoAdvance } = params;
  const [microphoneStatus, setMicrophoneStatus] = useState<PermissionStatus>(
    PermissionStatus.PERMISSION_STATUS_UNSPECIFIED,
  );
  const [microphoneFeedback, setMicrophoneFeedback] = useState<FeedbackState>('idle');
  const autoAdvanceScheduledRef = useRef(false);
  const isActiveRef = useRef(false);

  const {
    startPolling: startMicrophonePolling,
    stopPolling: stopMicrophonePolling,
  } = usePermissionPolling({
    intervalMs: PERMISSION_POLL_INTERVAL_MS,
    poll: async (): Promise<boolean> => {
      const latestStatus = await refreshMicrophoneStatus();
      if (
        !isActiveRef.current
        || latestStatus !== PermissionStatus.PERMISSION_STATUS_GRANTED
        || autoAdvanceScheduledRef.current
      ) {
        return false;
      }

      autoAdvanceScheduledRef.current = true;
      setMicrophoneFeedback('success');
      scheduleAutoAdvance('MIC_GRANTED');
      return true;
    },
  });

  useEffect(() => {
    if (!isStepActive) {
      isActiveRef.current = false;
      autoAdvanceScheduledRef.current = false;
      stopMicrophonePolling();
      return;
    }

    isActiveRef.current = true;
    autoAdvanceScheduledRef.current = false;
    startMicrophonePolling();

    return () => {
      isActiveRef.current = false;
      autoAdvanceScheduledRef.current = false;
      stopMicrophonePolling();
    };
  }, [isStepActive, startMicrophonePolling, stopMicrophonePolling]);

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
        autoAdvanceScheduledRef.current = true;
        setMicrophoneFeedback('success');
        stopMicrophonePolling();
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
