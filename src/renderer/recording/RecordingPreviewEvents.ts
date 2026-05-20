import { RecordingPhase } from '../gen/reverse_ipc_bridge';

export const RECORDING_PREVIEW_CHANNEL_NAME = 'movoice:recording-preview';

/**
 * Recording lifecycle update emitted for lightweight renderer previews.
 */
export interface RecordingPreviewStateEvent {
  readonly type: 'recording-state';
  readonly sessionId: string;
  readonly phase: RecordingPhase | 'error';
  readonly errorMessage: string | null;
}

/**
 * Incremental transcription text emitted during streaming recognition.
 */
export interface RecordingPreviewPartialEvent {
  readonly type: 'partial-transcription';
  readonly sessionId: string;
  readonly text: string;
}

/**
 * Final transcription text emitted after a recording finishes processing.
 */
export interface RecordingPreviewCompletedEvent {
  readonly type: 'completed-transcription';
  readonly sessionId: string;
  readonly text: string;
}

export type RecordingPreviewEvent =
  | RecordingPreviewStateEvent
  | RecordingPreviewPartialEvent
  | RecordingPreviewCompletedEvent;

/**
 * Publishes recording preview events to renderer windows that opt in.
 */
export class RecordingPreviewEventPublisher {
  private readonly channel = new BroadcastChannel(RECORDING_PREVIEW_CHANNEL_NAME);

  /**
   * Emits one preview event.
   */
  publish(event: RecordingPreviewEvent): void {
    this.channel.postMessage(event);
  }

  /**
   * Releases the backing browser broadcast channel.
   */
  close(): void {
    this.channel.close();
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPreviewPhase(value: unknown): value is RecordingPhase | 'error' {
  return value === 'error'
    || value === RecordingPhase.RECORDING_PHASE_IDLE
    || value === RecordingPhase.RECORDING_PHASE_PROCESSING
    || value === RecordingPhase.RECORDING_PHASE_RECORDING
    || value === RecordingPhase.RECORDING_PHASE_UNSPECIFIED;
}

/**
 * Validates an unknown broadcast payload before the welcome UI consumes it.
 */
export function isRecordingPreviewEvent(value: unknown): value is RecordingPreviewEvent {
  if (!isObject(value) || typeof value.type !== 'string') return false;

  if (value.type === 'recording-state') {
    return typeof value.sessionId === 'string'
      && isPreviewPhase(value.phase)
      && (typeof value.errorMessage === 'string' || value.errorMessage === null);
  }

  if (value.type === 'partial-transcription' || value.type === 'completed-transcription') {
    return typeof value.sessionId === 'string' && typeof value.text === 'string';
  }

  return false;
}
