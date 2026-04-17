import { ipc } from '@mobrowser/api';
import { ReverseIpcBridgeService as createReverseIpcBridgeService, type ReverseIpcBridgeService as ReverseIpcBridgeServiceInterface } from '../gen/ipc_service';
import type { PollRequest } from '../gen/reverse_ipc_bridge';
import type { RecordingSessionController } from '../recording/RecordingSessionController';

/**
 * Registers the ReverseIpcBridge service, providing the renderer with a typed
 * polling endpoint for recording state.
 */
export function registerReverseIpcBridge(controller: RecordingSessionController): void {
  ipc.registerService(createReverseIpcBridgeService(new ReverseIpcBridgeService(controller)));
}

class ReverseIpcBridgeService implements ReverseIpcBridgeServiceInterface {
  constructor(private readonly controller: RecordingSessionController) {}

  Poll(_request: PollRequest) {
    const session = this.controller.getActiveSession();
    return Promise.resolve({
      recording: {
        state: this.controller.getState(),
        sessionId: session?.id ?? '',
        startedAt: session?.startedAt ?? 0,
        dontSaveAudio: session?.dontSaveAudio ?? false,
        dontSaveTranscripts: session?.dontSaveTranscripts ?? false,
        maxDurationMs: session?.maxDurationMs ?? 0,
      },
    });
  }
}
