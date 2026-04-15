import type { JSX } from 'react';
import { useState, useEffect } from 'react';
import { LayoutDashboard, Settings, Brain, Shield } from 'lucide-react';
import type { PreferencesProto } from '@/gen/settings';
import type { DashboardStatsResponse } from '@/gen/stats';
import type { ModelEntryProto } from '@/gen/model';
import type { PermissionStatusProto } from '@/gen/permissions';
import { ipc } from '@/gen/ipc';
import { cn } from '@/lib/utils';
import { DashboardPage } from './DashboardPage';
import { GeneralPage } from './GeneralPage';
import { ModelsPage } from './ModelsPage';
import { PermissionsPage } from './PermissionsPage';

type SettingsPage = 'dashboard' | 'general' | 'models' | 'permissions';

const NAV_ITEMS: readonly { id: SettingsPage; label: string; icon: JSX.Element }[] = [
  { id: 'dashboard',   label: 'Dashboard',   icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'general',     label: 'General',     icon: <Settings className="w-4 h-4" /> },
  { id: 'models',      label: 'Models',      icon: <Brain className="w-4 h-4" /> },
  { id: 'permissions', label: 'Permissions', icon: <Shield className="w-4 h-4" /> },
];

/** Reads the initial page from the hash query string, e.g. `#settings?page=permissions`. */
function resolveInitialPage(): SettingsPage {
  const hash = window.location.hash;
  if (!hash.includes('?')) return 'dashboard';
  const params = new URLSearchParams(hash.split('?')[1]);
  const page = params.get('page');
  if (page === 'general' || page === 'models' || page === 'permissions') return page;
  return 'dashboard';
}

interface AppData {
  prefs: PreferencesProto
  stats: DashboardStatsResponse
  models: ModelEntryProto[]
  storagePath: string
  permissions: PermissionStatusProto[]
}

/** Fetches all data needed for the Settings window in a single batch. */
async function fetchAll(): Promise<AppData> {
  const [prefsResponse, statsResponse, modelsResponse, permsResponse] = await Promise.all([
    ipc.settings.GetPreferences({}),
    ipc.stats.GetStats({}),
    ipc.model.GetModels({}),
    ipc.permissions.GetPermissions({}),
  ]);

  return {
    prefs: prefsResponse.preferences ?? {
      shortcutKey: 'F5',
      shortcutMode: 'toggle',
      hideDockIcon: false,
      launchAtLogin: false,
      dontSaveTranscripts: false,
      dontSaveAudio: false,
      activeModelId: 'builtin',
      primaryLanguage: 'auto',
      modelStoragePath: '',
    },
    stats: statsResponse,
    models: modelsResponse.models,
    storagePath: modelsResponse.storagePath,
    permissions: permsResponse.permissions,
  };
}

/**
 * Settings window root component.
 *
 * Renders a two-column layout: a sidebar with page navigation on the left
 * and the active page's content on the right. All data is fetched on mount
 * and re-fetched after any mutation via `handleRefetch`.
 */
export function SettingsApp(): JSX.Element {
  const [page, setPage] = useState<SettingsPage>(resolveInitialPage);
  const [data, setData] = useState<AppData | null>(null);

  useEffect(() => {
    fetchAll()
      .then(setData)
      .catch((err: unknown) => { console.error('[SettingsApp] Initial fetch error:', err); });
  }, []);

  const handleRefetch = (): void => {
    fetchAll()
      .then(setData)
      .catch((err: unknown) => { console.error('[SettingsApp] Refetch error:', err); });
  };

  const handlePermissionsRefreshed = (permissions: PermissionStatusProto[]): void => {
    if (data !== null) {
      setData({ ...data, permissions });
    }
  };

  const renderPage = (): JSX.Element | null => {
    if (data === null) return null;

    switch (page) {
      case 'dashboard':
        return <DashboardPage stats={data.stats} />;
      case 'general':
        return (
          <GeneralPage
            prefs={data.prefs}
            models={data.models}
            onChanged={handleRefetch}
          />
        );
      case 'models':
        return (
          <ModelsPage
            models={data.models}
            storagePath={data.storagePath}
            onChanged={handleRefetch}
          />
        );
      case 'permissions':
        return (
          <PermissionsPage
            permissions={data.permissions}
            onRefreshed={handlePermissionsRefreshed}
          />
        );
    }
  };

  return (
    <div className="flex h-full bg-background show-animation">
      {/* Sidebar */}
      <nav className="w-48 flex-shrink-0 border-r border-border bg-muted/30 p-3 flex flex-col gap-1">
        <div className="px-2 py-3 mb-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Settings</p>
        </div>
        {NAV_ITEMS.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => { setPage(id); }}
            className={cn(
              'flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm font-medium transition-colors text-left',
              page === id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/60',
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {data === null ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : (
          renderPage()
        )}
      </main>
    </div>
  );
}
