import type { AppReadinessService } from '../readiness/AppReadinessService';
import type { WelcomeWindow } from '../welcome/WelcomeWindow';
import type { RecordingSessionController } from './RecordingSessionController';

/**
 * Starts recording from a user intent with one consistent readiness policy.
 */
export class StartRecordingFromIntentUseCase {
  private startInFlight = false;

  constructor(
    private readonly readiness: AppReadinessService,
    private readonly recordingController: RecordingSessionController,
    private readonly welcomeWindow: WelcomeWindow,
  ) {}

  /**
   * Starts recording when readiness passes, or opens setup when prerequisites are missing.
   */
  async startFromUserIntent(): Promise<void> {
    if (this.startInFlight) return;
    if (this.recordingController.getState() !== 'idle') return;

    this.startInFlight = true;
    try {
      const ready = await this.readiness.isReady();
      if (!ready) {
        this.welcomeWindow.show();
        return;
      }

      this.recordingController.start();
    } finally {
      this.startInFlight = false;
    }
  }
}
