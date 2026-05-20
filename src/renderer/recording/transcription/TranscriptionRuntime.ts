import { getRendererModelRepository } from '../../models/application/getRendererModelRepository';
import { RecordingPhase } from '../../gen/reverse_ipc_bridge';
import {
  RecordingPreviewEventPublisher,
} from '../RecordingPreviewEvents';
import { RecordingController } from '../RecordingController';
import { TranscriptionService } from '../application/TranscriptionService';
import {
  RecordingOrchestrator,
  type RecordingEventObserver,
} from '../application/RecordingOrchestrator';
import { BackendFactory } from './BackendFactory';

/*
 * Singletons that persist for the lifetime of the transcription worker window. Keeping
 * them outside the component ensures model weights and warm-up state survive
 * React re-renders.
 */
const modelRepository = getRendererModelRepository();
const transcriptionService = new TranscriptionService(
  modelRepository,
  new BackendFactory(),
);
const previewEventPublisher = new RecordingPreviewEventPublisher();
const recordingEventObserver: RecordingEventObserver = {
  onStateChanged(state): void {
    previewEventPublisher.publish({
      type: 'recording-state',
      sessionId: state.sessionId,
      phase: state.phase,
      errorMessage: state.errorMessage,
    });
  },
  onPartialTranscription(sessionId, text): void {
    previewEventPublisher.publish({
      type: 'partial-transcription',
      sessionId,
      text,
    });
  },
  onCompletedTranscription(sessionId, text): void {
    previewEventPublisher.publish({
      type: 'completed-transcription',
      sessionId,
      text,
    });
  },
};
const controller = new RecordingController(
  new RecordingOrchestrator(transcriptionService, recordingEventObserver),
);

function prewarmSilently(): void {
  void transcriptionService.prewarmCurrentModel().catch((err: unknown) => {
    console.error('[TranscriptionRuntime] prewarm failed:', err);
  });
}

// Re-prewarm when a recording session ends so model changes made during a
// session are picked up immediately, and the worker is ready for the next one.
let lastRecordingPhase = RecordingPhase.RECORDING_PHASE_UNSPECIFIED;
function onRecordingStateChanged(state: { phase: RecordingPhase | 'error' }): void {
  if (
    state.phase === RecordingPhase.RECORDING_PHASE_IDLE
    && lastRecordingPhase !== RecordingPhase.RECORDING_PHASE_IDLE
  ) {
    prewarmSilently();
  }
  if (state.phase !== 'error') {
    lastRecordingPhase = state.phase;
  }
}

/*
 * Prevents Chromium from throttling this hidden renderer tab. The lock is held
 * indefinitely for the application lifetime.
 */
void navigator.locks.request(
  'movoice-keep-alive',
  () => new Promise<void>((resolve) => { void resolve; }),
);

/**
 * Headless transcription runtime that owns the audio capture and transcription pipeline.
 */
export function startTranscriptionRuntime(): () => void {
  // Prewarm immediately so the inference worker is loaded before the first recording.
  prewarmSilently();

  // React to model activation events posted by the settings and welcome windows.
  const channel = new BroadcastChannel('movoice:model-activated');
  channel.addEventListener('message', prewarmSilently);

  const unsubscribe = controller.start(onRecordingStateChanged);
  return () => {
    unsubscribe();
    channel.close();
  };
}
