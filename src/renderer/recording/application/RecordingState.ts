/**
 * Stable recording lifecycle states reported by the main process.
 */
export type RecordingState = 'idle' | 'recording' | 'processing';

/**
 * Recording phase exposed to the view layer.
 */
export type RecordingPhase = RecordingState | 'error';

/**
 * Renderer-facing state required to render recording UI feedback.
 */
export interface RecordingViewState {
  readonly phase: RecordingPhase;
  readonly isAudioReady: boolean;
  readonly errorMessage: string | null;
}
