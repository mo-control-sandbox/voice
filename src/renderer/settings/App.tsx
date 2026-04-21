import { useRef, useState } from 'react';
import { LayoutDashboard, Settings, HardDrive, ShieldCheck } from 'lucide-react';
import { DashboardPage } from './pages/DashboardPage';
import { GeneralPage } from './pages/GeneralPage';
import { ModelsPage } from './pages/ModelsPage';
import { PermissionsPage } from './pages/PermissionsPage';
import './App.css';

type PageId = 'dashboard' | 'general' | 'models' | 'permissions';

interface NavItem {
  readonly id: PageId;
  readonly label: string;
  readonly icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: 'dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { id: 'general',     label: 'General',     icon: Settings        },
  { id: 'models',      label: 'Models',      icon: HardDrive       },
  { id: 'permissions', label: 'Permissions', icon: ShieldCheck     },
];

const PAGE_HEADINGS: Record<PageId, string> = {
  dashboard:   'Dashboard',
  general:     'General',
  models:      'Models',
  permissions: 'Permissions',
};

/** Root component for the Settings window — Panel surface with sidebar nav. */
export function SettingsApp(): React.JSX.Element {
  const [activePage, setActivePage] = useState<PageId>('models');
  const navRef = useRef<HTMLElement>(null);

  function renderActivePage(): React.JSX.Element {
    switch (activePage) {
      case 'dashboard':   return <DashboardPage />;
      case 'general':     return <GeneralPage />;
      case 'models':      return <ModelsPage />;
      case 'permissions': return <PermissionsPage />;
    }
  }

  /** Keyboard nav: ↑/↓ moves focus between sidebar items. */
  function handleNavKeyDown(e: React.KeyboardEvent<HTMLElement>): void {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();

    const items = Array.from(
      navRef.current?.querySelectorAll<HTMLButtonElement>('.settings-nav-item') ?? [],
    );
    if (items.length === 0) return;

    const focused = document.activeElement as HTMLButtonElement;
    const idx = items.indexOf(focused);

    if (e.key === 'ArrowDown') {
      items[Math.min(idx + 1, items.length - 1)]?.focus();
    } else {
      items[Math.max(idx - 1, 0)]?.focus();
    }
  }

  return (
    <div className="settings-app">
      <nav
        ref={navRef}
        className="settings-sidebar"
        aria-label="Settings sections"
        onKeyDown={handleNavKeyDown}
      >
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className="settings-nav-item"
            aria-current={activePage === id ? 'page' : undefined}
            onClick={() => { setActivePage(id); }}
          >
            <Icon className="settings-nav-item__icon" aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>

      <main
        className="settings-content"
        role="region"
        aria-label={PAGE_HEADINGS[activePage]}
      >
        {renderActivePage()}
      </main>
    </div>
  );
}
