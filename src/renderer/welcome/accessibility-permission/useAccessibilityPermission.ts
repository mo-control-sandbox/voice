import { useEffect, useRef, useState } from 'react';
import { PermissionStatus, PermissionType } from '../../gen/permissions';
import { ACCESSIBILITY_PERMISSION_POLL_INTERVAL_MS } from '../../capabilities/permissions/constants';
import { usePermissionPolling } from '../../capabilities/permissions/usePermissionPolling';
import { PermissionsService } from '../../settings/services/PermissionsService';
import type { WizardEventType } from '../flow';
import type { FeedbackState } from '../shared/feedback';
import { readRequiredPermissions } from '../shared/readRequiredPermissions';
const permissionsService = new PermissionsService();

/**
 * Owns accessibility permission state and polling flow for onboarding.
 */
export function useAccessibilityPermission(params: {
  readonly isStepActive: boolean;
  readonly scheduleAutoAdvance: (eventType: WizardEventType) => void;
}): {
  readonly accessibilityStatus: PermissionStatus;
  readonly accessibilityFeedback: FeedbackState;
  readonly setAccessibilityStatus: (status: PermissionStatus) => void;
  readonly refreshAccessibilityStatus: () => Promise<PermissionStatus>;
  readonly handleOpenAccessibilitySettings: () => Promise<void>;
} {
  const { isStepActive, scheduleAutoAdvance } = params;
  const [accessibilityStatus, setAccessibilityStatus] = useState<PermissionStatus>(
    PermissionStatus.PERMISSION_STATUS_UNSPECIFIED,
  );
  const [accessibilityFeedback, setAccessibilityFeedback] = useState<FeedbackState>('idle');
  const autoAdvanceScheduledRef = useRef(false);
  const isActiveRef = useRef(false);

  const {
    startPolling: startAccessibilityPolling,
    stopPolling: stopAccessibilityPolling,
  } = usePermissionPolling({
    intervalMs: ACCESSIBILITY_PERMISSION_POLL_INTERVAL_MS,
    timeoutMs: 0,
    poll: async (): Promise<boolean> => {
      const latestAccessibility = await refreshAccessibilityStatus();
      if (
        !isActiveRef.current
        || latestAccessibility !== PermissionStatus.PERMISSION_STATUS_GRANTED
        || autoAdvanceScheduledRef.current
      ) {
        return false;
      }

      autoAdvanceScheduledRef.current = true;
      setAccessibilityFeedback('success');
      scheduleAutoAdvance('ACCESSIBILITY_GRANTED');
      return true;
    },
  });

  useEffect(() => {
    if (!isStepActive) {
      isActiveRef.current = false;
      autoAdvanceScheduledRef.current = false;
      stopAccessibilityPolling();
      return;
    }

    isActiveRef.current = true;
    autoAdvanceScheduledRef.current = false;
    startAccessibilityPolling();

    return () => {
      isActiveRef.current = false;
      autoAdvanceScheduledRef.current = false;
      stopAccessibilityPolling();
    };
  }, [isStepActive, startAccessibilityPolling, stopAccessibilityPolling]);

  async function refreshAccessibilityStatus(): Promise<PermissionStatus> {
    const { accessibilityStatus: latestAccessibility } = await readRequiredPermissions();
    setAccessibilityStatus(latestAccessibility);
    return latestAccessibility;
  }

  async function handleOpenAccessibilitySettings(): Promise<void> {
    setAccessibilityFeedback('loading');

    try {
      await permissionsService.requestPermission(PermissionType.PERMISSION_TYPE_ACCESSIBILITY);
      const latestAccessibilityStatus = await refreshAccessibilityStatus();

      if (latestAccessibilityStatus === PermissionStatus.PERMISSION_STATUS_GRANTED) {
        autoAdvanceScheduledRef.current = true;
        setAccessibilityFeedback('success');
        stopAccessibilityPolling();
        scheduleAutoAdvance('ACCESSIBILITY_GRANTED');
      } else {
        setAccessibilityFeedback('info');
      }
    } catch {
      setAccessibilityFeedback('info');
    }
  }

  return {
    accessibilityStatus,
    accessibilityFeedback,
    setAccessibilityStatus,
    refreshAccessibilityStatus,
    handleOpenAccessibilitySettings,
  };
}
