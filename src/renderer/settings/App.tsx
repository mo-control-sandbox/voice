import { LayoutDashboard, Sliders, BrainCircuit, ShieldCheck } from 'lucide-react';
import { useEffect } from 'react';
import { DashboardPage } from './pages/DashboardPage';
import { GeneralPage } from './pages/GeneralPage';
import { ModelsPage } from './pages/ModelsPage';
import { PermissionsPage } from './pages/PermissionsPage';
import { type SettingsPageId, useSettingsNavigationController } from './controllers/useSettingsNavigationController';
import { useSetupRequirementsController } from './controllers/useSetupRequirementsController';
import './App.css';

const NAV_ITEMS = [
  { id: 'dashboard' as const, label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'general' as const, label: 'General', Icon: Sliders },
  { id: 'models' as const, label: 'Models', Icon: BrainCircuit },
  { id: 'permissions' as const, label: 'Permissions', Icon: ShieldCheck },
] as const;

/**
 * Root component for the Settings window. Owns page-level navigation.
 */
export function SettingsApp(): React.JSX.Element {
  const requirements = useSetupRequirementsController();
  const { activePage, setActivePage, setInitialPageFromRequirements } = useSettingsNavigationController();

  useEffect(() => {
    setInitialPageFromRequirements(requirements);
  }, [requirements, setInitialPageFromRequirements]);

  function renderActivePage(page: SettingsPageId | null): React.JSX.Element {
    switch (page) {
      case 'dashboard':
        return <DashboardPage />;
      case 'general':
        return <GeneralPage onOpenPermissions={() => { setActivePage('permissions'); }} />;
      case 'models':
        return <ModelsPage needsModel={requirements.needsModel} />;
      case 'permissions':
        return (
          <PermissionsPage
            needsMicrophonePermission={requirements.needsMicrophonePermission}
            needsAccessibilityPermission={requirements.needsAccessibilityPermission}
          />
        );
      case null:
        return <div className="settings-content__loading">Loading settings...</div>;
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
              <span className="settings-nav-item__label">{label}</span>
              {id === 'models' && requirements.needsModel && (
                <span className="settings-nav-item__marker" aria-label="Action required" />
              )}
              {id === 'permissions' && (
                (requirements.needsMicrophonePermission || requirements.needsAccessibilityPermission) && (
                  <span className="settings-nav-item__marker" aria-label="Action required" />
                )
              )}
            </button>
          ))}
        </nav>
      </aside>
      <main className="settings-content">
        {renderActivePage(activePage)}
      </main>
    </div>
  );
}
