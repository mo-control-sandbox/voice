import type { CancelRecordingRequest, StopRecordingRequest, SubmitTranscriptionRequest } from '../../gen/recording';
import type { RecordingState } from '../../gen/reverse_ipc_bridge';
import type { SettingsProto } from '../../gen/settings';

/**
 * Infrastructure boundary for recording-related IPC operations.
 */
export interface RecordingGateway {
  /**
   * Subscribes to recording signal snapshots coming from main process polling.
   */
  subscribeRecordingSignals(
    onChanged: (snapshot: RecordingState) => Promise<void>,
  ): () => void;

  /**
   * Reads current persisted application settings.
   */
  getSettings(): Promise<SettingsProto>;

  /**
   * Requests cancellation of the active recording session.
   */
  cancelRecording(request: CancelRecordingRequest): Promise<void>;

  /**
   * Requests stop transition for a specific recording session.
   */
  stopRecording(request: StopRecordingRequest): Promise<void>;

  /**
   * Sends one streaming partial transcription chunk.
   */
  pastePartialTranscription(sessionId: string, text: string): Promise<void>;

  /**
   * Sends completed transcription payload to main process.
   */
  submitTranscription(request: SubmitTranscriptionRequest): Promise<void>;

  /**
   * Sends a raw PCM chunk to the main process for incremental audio persistence.
   */
  appendAudioChunk(sessionId: string, pcm: Uint8Array): Promise<void>;
}
