import type { RecordingPhase as ProtoRecordingPhase } from '../../gen/reverse_ipc_bridge';

/**
 * Renderer-facing state required to render recording UI feedback.
 */
export interface RecordingViewState {
  readonly phase: ProtoRecordingPhase | 'error';
  readonly isAudioReady: boolean;
  readonly errorMessage: string | null;
}
