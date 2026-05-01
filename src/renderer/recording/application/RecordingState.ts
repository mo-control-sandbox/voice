import type { RecordingPhase as ProtoRecordingPhase } from '../../gen/reverse_ipc_bridge';

/**
 * Recording phase exposed to the view layer.
 */
export type RecordingPhase = ProtoRecordingPhase | 'error';

/**
 * Renderer-facing state required to render recording UI feedback.
 */
export interface RecordingViewState {
  readonly phase: RecordingPhase;
  readonly isAudioReady: boolean;
  readonly errorMessage: string | null;
}
