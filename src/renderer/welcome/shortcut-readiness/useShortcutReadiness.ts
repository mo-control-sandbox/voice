import { useEffect, useState } from 'react';
import { ipc } from '../../gen/ipc';
import { SettingsService } from '../../settings/services/SettingsService';

const settingsService = new SettingsService();

/**
 * Owns final-step shortcut data and onboarding completion marker.
 */
export function useShortcutReadiness(params: {
  readonly isFinalStep: boolean;
}): {
  readonly shortcutKey: string;
  readonly loadShortcutKey: () => Promise<void>;
} {
  const { isFinalStep } = params;
  const [shortcutKey, setShortcutKey] = useState('CommandOrControl+Shift+Space');
  const [onboardingMarked, setOnboardingMarked] = useState(false);

  useEffect(() => {
    if (!isFinalStep || onboardingMarked) return;

    void ipc.settings.MarkOnboardingComplete({}).then(() => {
      setOnboardingMarked(true);
    });
  }, [isFinalStep, onboardingMarked]);

  async function loadShortcutKey(): Promise<void> {
    const settings = await settingsService.getSettings();
    setShortcutKey(settings.shortcutKey);
  }

  return {
    shortcutKey,
    loadShortcutKey,
  };
}
