import { ipc } from '../../gen/ipc';
import type { CancelRecordingRequest, StopRecordingRequest, SubmitTranscriptionRequest } from '../../gen/recording';
import type { RecordingSignalSnapshotProto } from '../../gen/reverse_ipc_bridge';
import type { SettingsProto } from '../../gen/settings';
import { recordingSignalChannel } from './RecordingSignalChannel';
import type { RecordingGateway } from '../application/RecordingGateway';

/**
 * IPC-backed gateway for recording renderer operations.
 */
export class IpcRecordingGateway implements RecordingGateway {
  /**
   * Registers a recording signal listener with reverse IPC polling.
   */
  subscribeRecordingSignals(
    onChanged: (snapshot: RecordingSignalSnapshotProto) => Promise<void>,
  ): () => void {
    return recordingSignalChannel.subscribe(onChanged);
  }

  /**
   * Reads current settings from the main process.
   */
  async getSettings(): Promise<SettingsProto> {
    return ipc.settings.GetSettings({});
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
  async pastePartialTranscription(sessionId: string, text: string): Promise<void> {
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
