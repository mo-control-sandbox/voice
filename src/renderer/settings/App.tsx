import { useEffect, useState } from 'react';
import { LayoutDashboard, Sliders, BrainCircuit, ShieldCheck } from 'lucide-react';
import { PermissionStatus, PermissionType, type PermissionStatusProto } from '../gen/permissions';
import { DashboardPage } from './pages/DashboardPage';
import { GeneralPage } from './pages/GeneralPage';
import { ModelsPage } from './pages/ModelsPage';
import { PermissionsPage } from './pages/PermissionsPage';
import { PermissionsService } from './services/PermissionsService';
import './App.css';

type PageId = 'dashboard' | 'general' | 'models' | 'permissions';

const permissionsService = new PermissionsService();

const REQUIRED_PERMISSION_TYPES = [
  PermissionType.PERMISSION_TYPE_MICROPHONE,
  PermissionType.PERMISSION_TYPE_ACCESSIBILITY,
] as const;

const NAV_ITEMS = [
  { id: 'dashboard'   as const, label: 'Dashboard',   Icon: LayoutDashboard },
  { id: 'general'     as const, label: 'General',     Icon: Sliders },
  { id: 'models'      as const, label: 'Models',      Icon: BrainCircuit },
  { id: 'permissions' as const, label: 'Permissions', Icon: ShieldCheck },
] as const;

function hasMissingRequiredPermissions(permissions: readonly PermissionStatusProto[]): boolean {
  return REQUIRED_PERMISSION_TYPES.some((type) => {
    const permission = permissions.find((entry) => entry.type === type);
    return permission?.status !== PermissionStatus.PERMISSION_STATUS_GRANTED;
  });
}

/**
 * Root component for the Settings window. Owns page-level navigation.
 */
export function SettingsApp(): React.JSX.Element {
  const [activePage, setActivePage] = useState<PageId | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function chooseInitialPage(): Promise<void> {
      try {
        const response = await permissionsService.getPermissions();
        if (isCancelled) return;
        setActivePage(hasMissingRequiredPermissions(response.permissions) ? 'permissions' : 'dashboard');
      } catch {
        if (!isCancelled) setActivePage('dashboard');
      }
    }

    void chooseInitialPage();
    return () => {
      isCancelled = true;
    };
  }, []);

  function renderActivePage(): React.JSX.Element {
    switch (activePage) {
      case 'dashboard':   return <DashboardPage />;
      case 'general':     return <GeneralPage onOpenPermissions={() => { setActivePage('permissions'); }} />;
      case 'models':      return <ModelsPage />;
      case 'permissions': return <PermissionsPage />;
      case null:          return <div className="settings-content__loading">Loading settings...</div>;
    }
  }

  return (
    <div className="settings-app">
      <aside className="settings-sidebar">
        <div className="settings-sidebar__header">
          <span className="settings-sidebar__app-name">MoVoice</span>
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
