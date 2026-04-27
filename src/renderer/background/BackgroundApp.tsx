import { useEffect } from 'react';
import { RendererModelCatalog } from '../services/RendererModelCatalog';
import { OPFSModelCache } from '../services/OPFSModelCache';
import { RendererModelStateStore } from '../services/RendererModelStateStore';
import { RendererModelRepository } from '../services/RendererModelRepository';
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
const catalog = new RendererModelCatalog();
const modelRepository = new RendererModelRepository(
  catalog,
  new OPFSModelCache(catalog.getDefinitions()),
  new RendererModelStateStore(),
);
const transcriptionService = new DefaultTranscriptionService(
  modelRepository,
  new MoVoiceBackendFactory(),
);
const gateway = new IpcRecordingGateway();
const controller = new RecordingController(
  new RecordingOrchestrator(gateway, transcriptionService),
);
const ignoreStateUpdate = (): void => {
  return;
};

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
    return controller.start(ignoreStateUpdate);
  }, []);

  return <></>;
}
