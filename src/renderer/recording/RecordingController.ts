import type { RecordingOrchestrator } from './application/RecordingOrchestrator';
import type { RecordingPhase as ProtoRecordingPhase } from '../gen/reverse_ipc_bridge';

/**
 * Renderer-facing state required to render recording UI feedback.
 */
export interface RecordingViewState {
  readonly phase: ProtoRecordingPhase | 'error';
  readonly isAudioReady: boolean;
  readonly errorMessage: string | null;
}

/**
 * Facade that adapts recording orchestration to the renderer view lifecycle.
 */
export class RecordingController {
  constructor(private readonly orchestrator: RecordingOrchestrator) {}

  /**
   * Starts background signal handling and forwards state updates to the caller.
   */
  start(onStateChanged: (state: RecordingViewState) => void): () => void {
    return this.orchestrator.start(onStateChanged);
  }

  /**
   * Cancels the currently active recording workflow.
   */
  cancel(): void {
    this.orchestrator.cancel();
  }
}
