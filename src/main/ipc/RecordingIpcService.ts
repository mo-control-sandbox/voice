import type { RecordingService } from '../gen/ipc_service';
import type { RecordingSessionController } from '../domain/RecordingSessionController';
import { RecordingState } from '../gen/recording';
import type { Empty } from '../gen/google/protobuf/empty';
import type { RecordingStatusResponse, SubmitAudioRequest } from '../gen/recording';

/** Maps the domain FSM state string to the proto RecordingState enum value. */
function toProtoState(state: 'idle' | 'recording' | 'processing'): RecordingState {
  switch (state) {
    case 'idle': return RecordingState.IDLE;
    case 'recording': return RecordingState.RECORDING;
    case 'processing': return RecordingState.PROCESSING;
  }
}

/**
 * IPC service that exposes the RecordingSessionController to the renderer process.
 * Handles state polling, audio submission, and cancel requests.
 */
export class RecordingIpcService implements RecordingService {
  constructor(private readonly controller: RecordingSessionController) {}

  GetStatus(_request: Empty): Promise<RecordingStatusResponse> {
    return Promise.resolve({ state: toProtoState(this.controller.getState()), error: undefined });
  }

  CancelRecording(_request: Empty): Promise<Empty> {
    this.controller.cancel();
    return Promise.resolve({});
  }

  SubmitAudio(request: SubmitAudioRequest): Promise<Empty> {
    // Reinterpret the raw bytes as a Float32Array (4 bytes per sample, little-endian).
    const buffer = request.pcm instanceof Buffer
      ? request.pcm.buffer.slice(request.pcm.byteOffset, request.pcm.byteOffset + request.pcm.byteLength)
      : request.pcm.buffer;
    const pcm = new Float32Array(buffer);
    this.controller.submitAudio(pcm);
    return Promise.resolve({});
  }
}
