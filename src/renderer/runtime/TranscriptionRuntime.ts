import { getRendererModelRepository } from '../services/getRendererModelRepository';
import { MoVoiceBackendFactory } from '../recording/services/MoVoiceBackendFactory';
import { RecordingController } from '../recording/RecordingController';
import { DefaultTranscriptionService } from '../recording/services/DefaultTranscriptionService';
import { RecordingOrchestrator } from '../recording/application/RecordingOrchestrator';
import { RecordingIpc } from '../recording/infrastructure/RecordingIpc';
import { RecordSeetingsProvider } from '../recording/infrastructure/RecordSeetingsProvider';

/*
 * Singletons that persist for the lifetime of the transcription worker window. Keeping
 * them outside the component ensures model weights and warm-up state survive
 * React re-renders.
 */
const modelRepository = getRendererModelRepository();
const transcriptionService = new DefaultTranscriptionService(
  modelRepository,
  new MoVoiceBackendFactory(),
);
const recordingIpc = new RecordingIpc();
const settingsProvider = new RecordSeetingsProvider();
const controller = new RecordingController(
  new RecordingOrchestrator(recordingIpc, settingsProvider, transcriptionService),
);

function prewarmSilently(): void {
  void transcriptionService.prewarmCurrentModel().catch((err: unknown) => {
    console.error('[TranscriptionRuntime] prewarm failed:', err);
  });
}

// Re-prewarm when a recording session ends so model changes made during a
// session are picked up immediately, and the worker is ready for the next one.
let lastRecordingPhase = '';
function onRecordingStateChanged(state: { phase: string }): void {
  if (state.phase === 'idle' && lastRecordingPhase !== 'idle') {
    prewarmSilently();
  }
  lastRecordingPhase = state.phase;
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
