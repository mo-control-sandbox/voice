import { ipc } from '../gen/ipc';
import type { ModelEntry } from '../types/models';

/**
 * Reports whether any downloaded and active model is available to the main
 * process so it can enable or disable the "Start Recording" tray menu item.
 */
export async function reportModelReadiness(models: ModelEntry[]): Promise<void> {
  const isReady = models.some((m) => m.isActive && m.isDownloaded);
  try {
    await ipc.settings.SetModelReady({ value: isReady });
  } catch (err) {
    console.error('[ModelReadinessReporter] Failed to report model readiness:', err);
  }
}
