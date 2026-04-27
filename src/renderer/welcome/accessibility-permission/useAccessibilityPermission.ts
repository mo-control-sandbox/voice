import { useEffect, useState } from 'react';
import { PermissionStatus, PermissionType } from '../../gen/permissions';
import { PermissionsService } from '../../settings/services/PermissionsService';
import type { WizardEventType } from '../flow';
import type { FeedbackState } from '../shared/feedback';
import { findPermissionStatus } from '../shared/permissionStatus';

const ACCESSIBILITY_POLL_INTERVAL_MS = 700;
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

  useEffect(() => {
    if (!isStepActive) {
      return;
    }

    let disposed = false;
    let autoAdvanceScheduled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const runPoll = async (): Promise<void> => {
      const latestAccessibility = await refreshAccessibilityStatus();
      if (disposed) return;

      if (
        latestAccessibility === PermissionStatus.PERMISSION_STATUS_GRANTED
        && !autoAdvanceScheduled
      ) {
        autoAdvanceScheduled = true;
        if (intervalId !== null) {
          clearInterval(intervalId);
          intervalId = null;
        }
        setAccessibilityFeedback('success');
        scheduleAutoAdvance('ACCESSIBILITY_GRANTED');
      }
    };

    void runPoll();
    intervalId = setInterval(() => {
      void runPoll();
    }, ACCESSIBILITY_POLL_INTERVAL_MS);

    return () => {
      disposed = true;
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
    };
  }, [isStepActive, scheduleAutoAdvance]);

  async function refreshAccessibilityStatus(): Promise<PermissionStatus> {
    const response = await permissionsService.refreshPermissions();
    const latestAccessibility = findPermissionStatus(
      response.permissions,
      PermissionType.PERMISSION_TYPE_ACCESSIBILITY,
    );
    setAccessibilityStatus(latestAccessibility);
    return latestAccessibility;
  }

  async function handleOpenAccessibilitySettings(): Promise<void> {
    setAccessibilityFeedback('loading');

    try {
      await permissionsService.requestPermission(PermissionType.PERMISSION_TYPE_ACCESSIBILITY);
      const latestAccessibilityStatus = await refreshAccessibilityStatus();

      if (latestAccessibilityStatus === PermissionStatus.PERMISSION_STATUS_GRANTED) {
        setAccessibilityFeedback('success');
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
