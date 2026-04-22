import { useState } from 'react';
import { LayoutDashboard, Sliders, BrainCircuit, ShieldCheck } from 'lucide-react';
import { DashboardPage } from './pages/DashboardPage';
import { GeneralPage } from './pages/GeneralPage';
import { ModelsPage } from './pages/ModelsPage';
import { PermissionsPage } from './pages/PermissionsPage';
import './App.css';

type PageId = 'dashboard' | 'general' | 'models' | 'permissions';

const NAV_ITEMS = [
  { id: 'dashboard'   as const, label: 'Dashboard',   Icon: LayoutDashboard },
  { id: 'general'     as const, label: 'General',     Icon: Sliders },
  { id: 'models'      as const, label: 'Models',      Icon: BrainCircuit },
  { id: 'permissions' as const, label: 'Permissions', Icon: ShieldCheck },
] as const;

/** Root component for the Settings window. Owns page-level navigation. */
export function SettingsApp(): React.JSX.Element {
  const [activePage, setActivePage] = useState<PageId>('dashboard');

  function renderActivePage(): React.JSX.Element {
    switch (activePage) {
      case 'dashboard':   return <DashboardPage />;
      case 'general':     return <GeneralPage />;
      case 'models':      return <ModelsPage />;
      case 'permissions': return <PermissionsPage />;
    }
  }

  return (
    <div className="settings-app">
      <aside className="settings-sidebar">
        <div className="settings-sidebar__header">
          <span className="settings-sidebar__app-name">moVoice</span>
        </div>
        <nav className="settings-sidebar__nav">
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className="settings-nav-item"
              aria-current={activePage === id ? 'page' : undefined}
              onClick={() => { setActivePage(id); }}
            >
              <Icon className="settings-nav-item__icon" aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="settings-content">
        {renderActivePage()}
      </main>
    </div>
  );
}
