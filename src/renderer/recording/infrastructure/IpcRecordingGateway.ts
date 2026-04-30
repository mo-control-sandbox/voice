import { ipc } from '../../gen/ipc';
import type { CancelRecordingRequest, StopRecordingRequest, SubmitTranscriptionRequest } from '../../gen/recording';
import type { RecordingState } from '../../gen/reverse_ipc_bridge';
import { recordingSignalChannel } from './RecordingSignalChannel';
import type { RecordingStateGateway } from '../application/RecordingStateGateway';

/**
 * IPC-backed gateway for recording renderer operations.
 */
export class IpcRecordingGateway implements RecordingStateGateway {
  /**
   * Registers a listener for recording state snapshots from reverse IPC polling.
   */
  subscribeToRecordingState(
    onChanged: (snapshot: RecordingState) => Promise<void>,
  ): () => void {
    return recordingSignalChannel.subscribe(onChanged);
  }

  /**
   * Sends a session cancellation request.
   */
  async cancelRecording(request: CancelRecordingRequest): Promise<void> {
    await ipc.recording.CancelRecording(request);
  }

  /**
   * Sends a stop request for the provided session.
   */
  async stopRecording(request: StopRecordingRequest): Promise<void> {
    await ipc.recording.StopRecording(request);
  }

  /**
   * Sends one partial transcription chunk.
   */
  async streamPartialTranscription(sessionId: string, text: string): Promise<void> {
    await ipc.recording.PastePartialTranscription({ sessionId, text });
  }

  /**
   * Sends completed transcription payload.
   */
  async submitTranscription(request: SubmitTranscriptionRequest): Promise<void> {
    await ipc.recording.SubmitTranscription(request);
  }

  /**
   * Sends a raw PCM chunk for incremental audio persistence.
   */
  async appendAudioChunk(sessionId: string, pcm: Uint8Array): Promise<void> {
    await ipc.recording.AppendAudioChunk({ sessionId, pcm });
  }
}
