export type SettingsPageId = 'dashboard' | 'history' | 'general' | 'models' | 'permissions' | 'about';
export const SETTINGS_PAGE_IDS: readonly SettingsPageId[] = ['dashboard', 'history', 'general', 'models', 'permissions', 'about'];

/**
 * Converts a settings page id to a hash-router pathname.
 */
export function getSettingsPagePath(pageId: SettingsPageId): string {
  return `/${pageId}`;
}
