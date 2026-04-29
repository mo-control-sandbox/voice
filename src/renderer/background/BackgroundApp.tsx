import { useEffect } from 'react';
import { getRendererModelRepository } from '../services/getRendererModelRepository';
import { MoVoiceBackendFactory } from '../recording/services/MoVoiceBackendFactory';
import { RecordingController } from '../recording/RecordingController';
import { DefaultTranscriptionService } from '../recording/services/DefaultTranscriptionService';
import { RecordingOrchestrator } from '../recording/application/RecordingOrchestrator';
import { IpcRecordingGateway } from '../recording/infrastructure/IpcRecordingGateway';

/*
 * Singletons that persist for the lifetime of the background window. Keeping
 * them outside the component ensures model weights and warm-up state survive
 * React re-renders.
 */
const modelRepository = getRendererModelRepository();
const transcriptionService = new DefaultTranscriptionService(
  modelRepository,
  new MoVoiceBackendFactory(),
);
const gateway = new IpcRecordingGateway();
const controller = new RecordingController(
  new RecordingOrchestrator(gateway, transcriptionService),
);

function prewarmSilently(): void {
  void transcriptionService.prewarmCurrentModel().catch((err: unknown) => {
    console.error('[BackgroundApp] prewarm failed:', err);
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
 * Headless background renderer that owns the audio capture and transcription pipeline.
 *
 * Invisible at all times. All activity is driven by RecordingController, which
 * polls the main process for session state and reports audio level and errors
 * back via IPC. The recording window renderer subscribes to those signals to
 * render the HUD.
 */
export function BackgroundApp(): React.JSX.Element {
  useEffect(() => {
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
  }, []);

  return <></>;
}
