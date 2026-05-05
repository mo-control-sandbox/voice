import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { AudioInputDevice } from '../infra/audio/audioDevices';
import { PermissionStatus } from '../gen/permissions';
import type { ModelEntry } from '../types/models';
import { WIZARD_STEPS, type WizardEventType, reduceWizard } from './flow';
import { useAccessibilityPermission } from './accessibility-permission/useAccessibilityPermission';
import { useMicrophonePermission } from './microphone-permission/useMicrophonePermission';
import { useMicrophoneSelection } from './microphone-selection/useMicrophoneSelection';
import { useModelSelection } from './model-selection/useModelSelection';
import type { FeedbackState } from './shared/feedback';
import { readRequiredPermissions } from './shared/readRequiredPermissions';
import { useShortcutReadiness } from './shortcut-readiness/useShortcutReadiness';

const AUTO_ADVANCE_DELAY_MS = 900;

/**
 * View state exposed by the onboarding controller.
 */
export interface WelcomeControllerState {
  readonly step: (typeof WIZARD_STEPS)[number];
  readonly stepIndex: number;
  readonly settingsLoaded: boolean;
  readonly models: readonly ModelEntry[];
  readonly downloadErrors: ReadonlyMap<string, string>;
  readonly downloadingModelId: string | null;
  readonly warmingUpModelId: string | null;
  readonly microphoneStatus: PermissionStatus;
  readonly accessibilityStatus: PermissionStatus;
  readonly microphoneFeedback: FeedbackState;
  readonly accessibilityFeedback: FeedbackState;
  readonly audioDevices: readonly AudioInputDevice[];
  readonly audioDevicesLoading: boolean;
  readonly selectedAudioDeviceId: string;
  readonly shortcutKey: string;
  readonly canContinue: boolean;
  readonly showContinue: boolean;
}

/**
 * Actions exposed by the onboarding controller.
 */
export interface WelcomeControllerActions {
  readonly moveToNextStep: () => void;
  readonly handleModelDownload: (id: string) => Promise<void>;
  readonly handleModelCancel: (id: string) => Promise<void>;
  readonly handleRequestMicrophonePermission: () => Promise<void>;
  readonly handleOpenAccessibilitySettings: () => Promise<void>;
  readonly handleAudioDeviceChange: (deviceId: string) => Promise<void>;
}

/**
 * Owns onboarding orchestration and step transitions for the welcome wizard.
 */
export function useWelcomeController(): {
  readonly state: WelcomeControllerState;
  readonly actions: WelcomeControllerActions;
} {
  const [wizard, dispatchWizard] = useReducer(reduceWizard, { step: 'welcome-model' as const });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const step = wizard.step;
  const stepIndex = WIZARD_STEPS.indexOf(step);

  const clearAutoAdvance = useCallback((): void => {
    if (autoAdvanceRef.current !== null) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
  }, []);

  const moveToNextStep = useCallback((): void => {
    dispatchWizard({ type: 'CONTINUE' });
  }, []);

  const scheduleAutoAdvance = useCallback((eventType: WizardEventType): void => {
    clearAutoAdvance();
    autoAdvanceRef.current = setTimeout(() => {
      autoAdvanceRef.current = null;
      dispatchWizard({ type: eventType });
    }, AUTO_ADVANCE_DELAY_MS);
  }, [clearAutoAdvance]);

  const modelSelection = useModelSelection();
  const microphonePermission = useMicrophonePermission({
    isStepActive: step === 'microphone-permission',
    clearAutoAdvance,
    scheduleAutoAdvance,
  });
  const accessibilityPermission = useAccessibilityPermission({
    isStepActive: step === 'accessibility-permission',
    scheduleAutoAdvance,
  });
  const microphoneSelection = useMicrophoneSelection({
    isStepActive: step === 'microphone-selection',
    isMicrophoneGranted: microphonePermission.microphoneStatus === PermissionStatus.PERMISSION_STATUS_GRANTED,
  });
  const shortcutReadiness = useShortcutReadiness({
    isFinalStep: step === 'final-shortcut',
  });
  const { refreshModels } = modelSelection;
  const { loadSelectedAudioDeviceId } = microphoneSelection;
  const { loadShortcutKey } = shortcutReadiness;
  const { setMicrophoneStatus } = microphonePermission;
  const { setAccessibilityStatus } = accessibilityPermission;

  const canContinue = useMemo((): boolean => {
    if (step === 'welcome-model') return modelSelection.hasReadyActiveModel;
    if (step === 'microphone-selection') return true;
    return false;
  }, [modelSelection.hasReadyActiveModel, step]);

  const showContinue = step !== 'microphone-permission'
    && step !== 'accessibility-permission'
    && step !== 'final-shortcut';

  useEffect(() => {
    void Promise.all([
      refreshModels(),
      loadSelectedAudioDeviceId(),
      loadShortcutKey(),
    ]).finally(() => {
      setSettingsLoaded(true);
    });
  }, [
    loadSelectedAudioDeviceId,
    loadShortcutKey,
    refreshModels,
  ]);

  useEffect(() => {
    if (step !== 'microphone-permission' && step !== 'accessibility-permission') {
      return;
    }

    let cancelled = false;
    const syncPermissionStatuses = async (): Promise<void> => {
      const { microphoneStatus, accessibilityStatus } = await readRequiredPermissions();
      if (cancelled) return;
      setMicrophoneStatus(microphoneStatus);
      setAccessibilityStatus(accessibilityStatus);
    };

    void syncPermissionStatuses();
    return () => {
      cancelled = true;
    };
  }, [setAccessibilityStatus, setMicrophoneStatus, step]);

  useEffect(() => {
    if (step === 'welcome-model' && modelSelection.hasReadyActiveModel && modelSelection.downloadingModelId === null) {
      scheduleAutoAdvance('MODEL_READY');
      return;
    }

    if (step === 'welcome-model') {
      clearAutoAdvance();
    }
  }, [
    clearAutoAdvance,
    modelSelection.downloadingModelId,
    modelSelection.hasReadyActiveModel,
    scheduleAutoAdvance,
    step,
  ]);

  useEffect(() => {
    if (
      step === 'microphone-permission'
      && microphonePermission.microphoneStatus === PermissionStatus.PERMISSION_STATUS_GRANTED
    ) {
      scheduleAutoAdvance('MIC_GRANTED');
      return;
    }

    if (step === 'microphone-permission') {
      clearAutoAdvance();
    }
  }, [
    clearAutoAdvance,
    microphonePermission.microphoneStatus,
    scheduleAutoAdvance,
    step,
  ]);

  useEffect(() => {
    return () => {
      clearAutoAdvance();
    };
  }, [clearAutoAdvance]);

  async function handleRequestMicrophonePermission(): Promise<void> {
    await microphonePermission.handleRequestMicrophonePermission();
    const { accessibilityStatus } = await readRequiredPermissions();
    setAccessibilityStatus(accessibilityStatus);
  }

  return {
    state: {
      step,
      stepIndex,
      settingsLoaded,
      models: modelSelection.models,
      downloadErrors: modelSelection.downloadErrors,
      downloadingModelId: modelSelection.downloadingModelId,
      warmingUpModelId: modelSelection.warmingUpModelId,
      microphoneStatus: microphonePermission.microphoneStatus,
      accessibilityStatus: accessibilityPermission.accessibilityStatus,
      microphoneFeedback: microphonePermission.microphoneFeedback,
      accessibilityFeedback: accessibilityPermission.accessibilityFeedback,
      audioDevices: microphoneSelection.audioDevices,
      audioDevicesLoading: microphoneSelection.audioDevicesLoading,
      selectedAudioDeviceId: microphoneSelection.selectedAudioDeviceId,
      shortcutKey: shortcutReadiness.shortcutKey,
      canContinue,
      showContinue,
    },
    actions: {
      moveToNextStep,
      handleModelDownload: modelSelection.handleModelDownload,
      handleModelCancel: modelSelection.handleModelCancel,
      handleRequestMicrophonePermission,
      handleOpenAccessibilitySettings: accessibilityPermission.handleOpenAccessibilitySettings,
      handleAudioDeviceChange: microphoneSelection.handleAudioDeviceChange,
    },
  };
}
