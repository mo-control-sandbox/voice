import { useCallback, useEffect, useState } from 'react';
import { RecordingPhase } from '../../gen/reverse_ipc_bridge';
import { ipc } from '../../gen/ipc';
import {
  isRecordingPreviewEvent,
  RECORDING_PREVIEW_CHANNEL_NAME,
  type RecordingPreviewEvent,
  type RecordingPreviewStateEvent,
} from '../../recording/RecordingPreviewEvents';
import { SettingsService } from '../../settings/services/SettingsService';

const settingsService = new SettingsService();

export type ShortcutDictationPreviewStatus = 'idle' | 'listening' | 'transcribing' | 'completed' | 'error';

/**
 * View model for the final-step dictation preview.
 */
export interface ShortcutDictationPreview {
  readonly status: ShortcutDictationPreviewStatus;
  readonly displayText: string;
  readonly isBusy: boolean;
}

interface PreviewState {
  readonly sessionId: string;
  readonly status: ShortcutDictationPreviewStatus;
  readonly text: string;
  readonly errorMessage: string | null;
}

const INITIAL_PREVIEW_STATE: PreviewState = {
  sessionId: '',
  status: 'idle',
  text: '',
  errorMessage: null,
};

function reduceRecordingState(prev: PreviewState, event: RecordingPreviewStateEvent): PreviewState {
  if (event.phase === RecordingPhase.RECORDING_PHASE_RECORDING) {
    return {
      sessionId: event.sessionId,
      status: 'listening',
      text: '',
      errorMessage: null,
    };
  }

  if (event.phase === RecordingPhase.RECORDING_PHASE_PROCESSING) {
    return {
      sessionId: event.sessionId,
      status: 'transcribing',
      text: prev.sessionId === event.sessionId ? prev.text : '',
      errorMessage: null,
    };
  }

  if (event.phase === 'error') {
    return {
      sessionId: event.sessionId,
      status: 'error',
      text: '',
      errorMessage: event.errorMessage ?? 'Could not start recording.',
    };
  }

  if (
    event.phase === RecordingPhase.RECORDING_PHASE_IDLE
    || event.phase === RecordingPhase.RECORDING_PHASE_UNSPECIFIED
  ) {
    return prev.status === 'completed' ? prev : INITIAL_PREVIEW_STATE;
  }

  return prev;
}

function reducePreviewState(prev: PreviewState, event: RecordingPreviewEvent): PreviewState {
  switch (event.type) {
    case 'recording-state':
      return reduceRecordingState(prev, event);
    case 'partial-transcription':
      return {
        sessionId: event.sessionId,
        status: prev.status === 'transcribing' ? 'transcribing' : 'listening',
        text: prev.sessionId === event.sessionId ? `${prev.text}${event.text}` : event.text,
        errorMessage: null,
      };
    case 'completed-transcription':
      return {
        sessionId: event.sessionId,
        status: 'completed',
        text: event.text,
        errorMessage: null,
      };
  }
}

function formatPreviewDisplayText(state: PreviewState): string {
  if (state.text.length > 0) return state.text;

  if (state.status === 'listening') return 'Listening...';
  if (state.status === 'transcribing') return 'Transcribing...';
  if (state.status === 'completed') return 'No speech detected.';
  if (state.status === 'error') return state.errorMessage ?? 'Could not start recording.';
  return '';
}

function toDictationPreview(state: PreviewState): ShortcutDictationPreview {
  return {
    status: state.status,
    displayText: formatPreviewDisplayText(state),
    isBusy: state.status === 'listening' || state.status === 'transcribing',
  };
}

/**
 * Owns final-step shortcut data and onboarding completion marker.
 */
export function useShortcutReadiness(params: {
  readonly isFinalStep: boolean;
}): {
  readonly shortcutKey: string;
  readonly dictationPreview: ShortcutDictationPreview;
  readonly loadShortcutKey: () => Promise<void>;
} {
  const { isFinalStep } = params;
  const [shortcutKey, setShortcutKey] = useState('CommandOrControl+Shift+Space');
  const [onboardingMarked, setOnboardingMarked] = useState(false);
  const [previewState, setPreviewState] = useState<PreviewState>(INITIAL_PREVIEW_STATE);

  useEffect(() => {
    if (!isFinalStep || onboardingMarked) return;

    void ipc.settings.MarkOnboardingComplete({}).then(() => {
      setOnboardingMarked(true);
    });
  }, [isFinalStep, onboardingMarked]);

  const loadShortcutKey = useCallback(async (): Promise<void> => {
    const settings = await settingsService.getSettings();
    setShortcutKey(settings.shortcutKey);
  }, []);

  useEffect(() => {
    if (!isFinalStep) return;

    const channel = new BroadcastChannel(RECORDING_PREVIEW_CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent<unknown>): void => {
      const payload = event.data;
      if (!isRecordingPreviewEvent(payload)) return;
      setPreviewState((prev) => reducePreviewState(prev, payload));
    };

    return () => {
      channel.onmessage = null;
      channel.close();
    };
  }, [isFinalStep]);

  return {
    shortcutKey,
    dictationPreview: toDictationPreview(previewState),
    loadShortcutKey,
  };
}
