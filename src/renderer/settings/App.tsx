import { useState } from 'react';
import { LayoutDashboard, Settings, HardDrive, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';
import { DashboardPage } from './pages/DashboardPage';
import { GeneralPage } from './pages/GeneralPage';
import { ModelsPage } from './pages/ModelsPage';
import { PermissionsPage } from './pages/PermissionsPage';

type PageId = 'dashboard' | 'general' | 'models' | 'permissions';

interface NavItem {
  readonly id: PageId;
  readonly label: string;
  readonly icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'general', label: 'General', icon: Settings },
  { id: 'models', label: 'Models', icon: HardDrive },
  { id: 'permissions', label: 'Permissions', icon: ShieldCheck },
];

/** The root component for the Settings window, providing sidebar navigation. */
export function SettingsApp(): React.JSX.Element {
  const [activePage, setActivePage] = useState<PageId>('models');

  function renderActivePage(): React.JSX.Element {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'general':
        return <GeneralPage />;
      case 'models':
        return <ModelsPage />;
      case 'permissions':
        return <PermissionsPage />;
    }
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* -webkit-app-region: drag makes the sidebar act as a drag handle for the window. */}
      <nav
        className="w-48 shrink-0 border-r border-border p-3 flex flex-col gap-1"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { setActivePage(item.id); }}
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors w-full text-left',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>
      <main className="flex-1 overflow-auto p-6">{renderActivePage()}</main>
    </div>
  );
}
