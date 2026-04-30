import { ipc } from '@mobrowser/api';
import { ReverseIpcBridgeService as createReverseIpcBridgeService, type ReverseIpcBridgeService as ReverseIpcBridgeServiceInterface } from '../gen/ipc_service';
import type { PollHistoryRevisionRequest, PollRecordingRequest } from '../gen/reverse_ipc_bridge';
import type { History } from '../sessions/History';
import type { RecordingSessionController } from '../recording/RecordingSessionController';

/**
 * Registers the reverse IPC bridge service that exposes process-safe polling
 * endpoints for renderer signal channels.
 */
export function registerReverseIpcBridge(controller: RecordingSessionController, historyStore: History): void {
  ipc.registerService(createReverseIpcBridgeService(new ReverseIpcBridgeService(controller, historyStore)));
}

class ReverseIpcBridgeService implements ReverseIpcBridgeServiceInterface {
  private historyRevision = 0;

  constructor(
    private readonly controller: RecordingSessionController,
    private readonly historyStore: History,
  ) {
    this.historyStore.onChanged(() => {
      this.historyRevision++;
    });
  }

  PollRecording(_request: PollRecordingRequest) {
    const session = this.controller.getActiveSession();
    return Promise.resolve({
      recording: {
        state: this.controller.getState(),
        sessionId: session?.id ?? '',
        startedAt: session?.startedAt ?? 0,
        saveAudio: session?.saveAudio ?? false,
        saveTranscripts: session?.saveTranscripts ?? false,
      },
    });
  }

  PollHistoryRevision(_request: PollHistoryRevisionRequest) {
    return Promise.resolve({
      historyRevision: this.historyRevision,
    });
  }
}
