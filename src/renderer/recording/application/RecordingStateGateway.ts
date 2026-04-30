import type { CancelRecordingRequest, StopRecordingRequest, SubmitTranscriptionRequest } from '../../gen/recording';
import type { RecordingState } from '../../gen/reverse_ipc_bridge';

/**
 * Application boundary for recording state synchronization and recording commands.
 */
export interface RecordingStateGateway {
  /**
   * Subscribes to recording state snapshots emitted by the main process.
   */
  subscribeToRecordingState(
    onChanged: (snapshot: RecordingState) => Promise<void>,
  ): () => void;

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
  streamPartialTranscription(sessionId: string, text: string): Promise<void>;

  /**
   * Sends completed transcription payload to main process.
   */
  submitTranscription(request: SubmitTranscriptionRequest): Promise<void>;

  /**
   * Sends a raw PCM chunk to the main process for incremental audio persistence.
   */
  appendAudioChunk(sessionId: string, pcm: Uint8Array): Promise<void>;
}
