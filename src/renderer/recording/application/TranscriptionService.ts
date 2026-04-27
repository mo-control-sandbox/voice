import type { SubmitTranscriptionRequest } from '../../gen/recording';

/**
 * Input data needed to start microphone capture for a session.
 */
export interface StartCaptureRequest {
  readonly sessionId: string;
  readonly audioInputDeviceId: string;
  readonly onTrackEnded: () => void;
  readonly onPartialResult: (text: string) => void;
  readonly onBatchMaxDurationReached: () => void;
}

/**
 * Result of attempting to start audio capture and backend session wiring.
 */
export type StartCaptureResult =
  | { readonly status: 'started' }
  | { readonly status: 'superseded' }
  | { readonly status: 'failed'; readonly errorMessage: string };

/**
 * Input data needed to finalize recording and process transcription.
 */
export interface StopAndProcessRequest {
  readonly sessionId: string;
  readonly dontSaveAudio: boolean;
}

/**
 * Finalization result emitted by the transcription service.
 */
export type StopAndProcessResult =
  | { readonly status: 'completed'; readonly submission: SubmitTranscriptionRequest }
  | { readonly status: 'cancelled' };

/**
 * Domain service that owns audio capture and model transcription lifecycle.
 */
export interface TranscriptionService {
  /**
   * Indicates whether the microphone pipeline is currently active.
   */
  readonly isAudioReady: boolean;

  /**
   * Starts capture and backend session wiring for the provided session.
   */
  startCapture(request: StartCaptureRequest): Promise<StartCaptureResult>;

  /**
   * Stops capture and resolves a completed transcription payload when available.
   */
  stopAndProcess(request: StopAndProcessRequest): Promise<StopAndProcessResult>;

  /**
   * Cancels active audio and inference work.
   */
  cancel(): Promise<void>;

  /**
   * Releases active resources without changing main-process session state.
   */
  cleanup(): Promise<void>;
}
