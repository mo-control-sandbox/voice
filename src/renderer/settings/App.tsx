import { CircleHelp, History, LayoutDashboard, Sliders, BrainCircuit, ShieldCheck } from 'lucide-react';
import {
  HashRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { AboutApp } from '../about/AboutApp';
import { HistoryApp } from '../history/HistoryApp';
import { DashboardPage } from './pages/DashboardPage';
import { ModelsPage } from './pages/ModelsPage';
import { PermissionsPage } from './pages/PermissionsPage';
import { SettingsPage } from './pages/SettingsPage';
import {
  getSettingsPagePath,
  type SettingsPageId,
} from './controllers/useSettingsNavigationController';
import { useSetupRequirementsController } from './controllers/useSetupRequirementsController';
import './App.css';

const NAV_ITEMS = [
  { id: 'dashboard' as const, label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'history' as const, label: 'History', Icon: History },
  { id: 'settings' as const, label: 'Settings', Icon: Sliders },
  { id: 'models' as const, label: 'Models', Icon: BrainCircuit },
  { id: 'permissions' as const, label: 'Permissions', Icon: ShieldCheck },
  { id: 'about' as const, label: 'About', Icon: CircleHelp },
] as const;

/**
 * Root component for the application window shell. Owns page-level navigation.
 */
export function App(): React.JSX.Element {
  return (
    <HashRouter>
      <SettingsShell />
    </HashRouter>
  );
}

function SettingsShell(): React.JSX.Element {
  const requirements = useSetupRequirementsController();
  const navigate = useNavigate();
  const location = useLocation();
  const initialPage = getInitialPage(requirements);
  const initialPath = getSettingsPagePath(initialPage);
  const isHistoryRoute = location.pathname === '/history';

  return (
    <div className="settings-app">
      <div className="draggable"></div>
      <aside className="settings-sidebar">
        <nav className="settings-sidebar__nav">
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const path = getSettingsPagePath(id);
            return (
            <NavLink
              key={id}
              className="settings-nav-item no-drag"
              to={path}
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
            </NavLink>
            );
          })}
        </nav>
      </aside>
      <main className={`settings-content ${isHistoryRoute ? 'settings-content--flush' : ''}`}>
        {requirements.loading && location.pathname === '/' ? (
          <div className="settings-content__loading">Loading settings...</div>
        ) : (
          <Routes>
            <Route path="/" element={<Navigate to={initialPath} replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/history" element={<HistoryApp embedded />} />
            <Route path="/general" element={<Navigate to={getSettingsPagePath('settings')} replace />} />
            <Route
              path="/settings"
              element={<SettingsPage onOpenPermissions={() => { void navigate(getSettingsPagePath('permissions')); }} />}
            />
            <Route path="/models" element={<ModelsPage needsModel={requirements.needsModel} />} />
            <Route
              path="/permissions"
              element={(
                <PermissionsPage
                  needsMicrophonePermission={requirements.needsMicrophonePermission}
                  needsAccessibilityPermission={requirements.needsAccessibilityPermission}
                />
              )}
            />
            <Route path="/about" element={<AboutApp embedded />} />
            <Route path="*" element={<Navigate to={initialPath} replace />} />
          </Routes>
        )}
      </main>
    </div>
  );
}

function getInitialPage(requirements: ReturnType<typeof useSetupRequirementsController>): SettingsPageId {
  if (requirements.needsModel) {
    return 'models';
  }
  if (requirements.needsMicrophonePermission || requirements.needsAccessibilityPermission) {
    return 'permissions';
  }
  return 'dashboard';
}
