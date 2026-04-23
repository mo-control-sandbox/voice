import { ipc } from '@mobrowser/api';
import { ReverseIpcBridgeService as createReverseIpcBridgeService, type ReverseIpcBridgeService as ReverseIpcBridgeServiceInterface } from '../gen/ipc_service';
import type { PollRequest } from '../gen/reverse_ipc_bridge';
import type { HistoryStore } from '../history/HistoryStore';
import type { RecordingSessionController } from '../recording/RecordingSessionController';

/**
 * Registers the ReverseIpcBridge service, providing the renderer with a typed
 * polling endpoint for recording state and history revision.
 */
export function registerReverseIpcBridge(controller: RecordingSessionController, historyStore: HistoryStore): void {
  ipc.registerService(createReverseIpcBridgeService(new ReverseIpcBridgeService(controller, historyStore)));
}

class ReverseIpcBridgeService implements ReverseIpcBridgeServiceInterface {
  constructor(
    private readonly controller: RecordingSessionController,
    private readonly historyStore: HistoryStore,
  ) {}

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
      historyRevision: this.historyStore.getRevision(),
    });
  }
}
