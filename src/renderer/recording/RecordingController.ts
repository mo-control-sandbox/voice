import type { RecordingOrchestrator } from './application/RecordingOrchestrator';
import type { RecordingViewState } from './application/RecordingState';

export type { RecordingViewState };

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
