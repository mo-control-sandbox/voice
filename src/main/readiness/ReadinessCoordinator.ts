import { PermissionStatus, PermissionType } from '../gen/permissions';
import type { SystemPermissionsService } from '../gen/native/permissions';
import type { SettingsStore } from '../settings/SettingsStore';

export interface ReadinessSnapshot {
  readonly isReady: boolean;
  readonly modelReady: boolean;
  readonly microphoneGranted: boolean;
  readonly accessibilityGranted: boolean;
}

type ReadinessListener = (snapshot: ReadinessSnapshot, previous: ReadinessSnapshot | null) => void;

/**
 * Owns readiness state in the main process and publishes reactive updates.
 */
export class ReadinessCoordinator {
  private snapshot: ReadinessSnapshot | null = null;
  private readonly listeners = new Set<ReadinessListener>();
  private refreshInFlight: Promise<ReadinessSnapshot> | null = null;

  constructor(
    private readonly settings: SettingsStore,
    private readonly systemPermissions: SystemPermissionsService,
  ) {}

  onReadinessChange(listener: ReadinessListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async isReady(): Promise<boolean> {
    const snapshot = await this.refresh();
    return snapshot.isReady;
  }

  async refresh(): Promise<ReadinessSnapshot> {
    if (this.refreshInFlight !== null) return this.refreshInFlight;

    this.refreshInFlight = (async () => {
      const next = await this.computeSnapshot();
      const previous = this.snapshot;
      let changed = false;
      if (previous === null) {
        changed = true;
      } else {
        changed = previous.modelReady !== next.modelReady
          || previous.microphoneGranted !== next.microphoneGranted
          || previous.accessibilityGranted !== next.accessibilityGranted
          || previous.isReady !== next.isReady;
      }

      if (changed) {
        this.snapshot = next;
        for (const listener of this.listeners) {
          listener(next, previous);
        }
      }
      this.snapshot = next;

      return next;
    })();

    try {
      return await this.refreshInFlight;
    } finally {
      this.refreshInFlight = null;
    }
  }

  private async computeSnapshot(): Promise<ReadinessSnapshot> {
    const modelReady = this.settings.isModelReady();
    const result = await this.systemPermissions.GetPermissionsStatus({});
    const grantedStatus = PermissionStatus.PERMISSION_STATUS_GRANTED as number;

    const hasGrantedPermission = (type: PermissionType): boolean => {
      const permission = result.permissions.find((entry) => (entry.type as number) === (type as number));
      return (permission?.status as number | undefined) === grantedStatus;
    };

    const microphoneGranted = hasGrantedPermission(PermissionType.PERMISSION_TYPE_MICROPHONE);
    const accessibilityGranted = hasGrantedPermission(PermissionType.PERMISSION_TYPE_ACCESSIBILITY);

    return {
      modelReady,
      microphoneGranted,
      accessibilityGranted,
      isReady: modelReady && microphoneGranted && accessibilityGranted,
    };
  }
}
