import { PermissionStatus, PermissionType } from '../gen/permissions';
import type { SettingsStore } from '../settings/SettingsStore';
import type { Permissions } from '../system/Permissions';

/**
 * The stages of the application readiness to transcribe speech.
 */
export interface Readiness {
  readonly modelReady: boolean;
  readonly microphoneGranted: boolean;
  readonly accessibilityGranted: boolean;
}

const NOT_READY: Readiness = {
  modelReady: false,
  microphoneGranted: false,
  accessibilityGranted: false,
};

type ReadinessListener = (ready: boolean) => void;

/**
 * Answers the question, if the application is ready to transcribe voice to text.
 */
export class ReadinessCoordinator {
  private readonly listeners = new Set<ReadinessListener>();
  private state: Readiness = NOT_READY;
  private hasComputedState = false;
  private recomputeRoutine: Promise<void> | null = null;

  constructor(
    private readonly settings: SettingsStore,
    private readonly permissions: Permissions,
  ) {}

  /**
   * Subscribes to readiness state changes.
   */
  onChange(listener: ReadinessListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Returns whether recording can start immediately for the current environment and settings.
   */
  async isReady(): Promise<boolean> {
    await this.recompute();
    return this.calculateIsReady(this.state);
  }

  /**
   * Re-evaluates readiness from settings and OS permissions, then updates state and emits change events.
   */
  async recompute(): Promise<void> {
    if (this.recomputeRoutine !== null) return this.recomputeRoutine;

    this.recomputeRoutine = (async () => {
      const next = await this.computeReadiness();
      const changed = !this.hasComputedState
        || this.state.modelReady !== next.modelReady
        || this.state.microphoneGranted !== next.microphoneGranted
        || this.state.accessibilityGranted !== next.accessibilityGranted;

      if (changed) {
        this.state = next;
        this.hasComputedState = true;
        const isReady = this.calculateIsReady(next);
        for (const listener of this.listeners) {
          listener(isReady);
        }
      }
      this.state = next;
      this.hasComputedState = true;
    })();

    try {
      return this.recomputeRoutine;
    } finally {
      this.recomputeRoutine = null;
    }
  }

  private computeReadiness(): Readiness {
    const modelReady = this.settings.isModelReady();
    const permissions = this.permissions.getPermissionsStatus();
    const grantedStatus = PermissionStatus.PERMISSION_STATUS_GRANTED;

    const hasGrantedPermission = (type: PermissionType): boolean => {
      const permission = permissions.find((entry) => entry.type === type);
      return permission?.status === grantedStatus;
    };

    const microphoneGranted = hasGrantedPermission(PermissionType.PERMISSION_TYPE_MICROPHONE);
    const accessibilityGranted = hasGrantedPermission(PermissionType.PERMISSION_TYPE_ACCESSIBILITY);

    return {
      modelReady,
      microphoneGranted,
      accessibilityGranted,
    };
  }

  private calculateIsReady(state: Readiness): boolean {
    return state.modelReady && state.microphoneGranted && state.accessibilityGranted;
  }
}
