import { useState } from 'react';
import { DashboardPage } from './pages/DashboardPage';
import { GeneralPage } from './pages/GeneralPage';
import { ModelsPage } from './pages/ModelsPage';
import { PermissionsPage } from './pages/PermissionsPage';

type PageId = 'dashboard' | 'general' | 'models' | 'permissions';

/** Root component for the Settings window. */
export function SettingsApp(): React.JSX.Element {
  const [activePage, setActivePage] = useState<PageId>('models');

  function renderActivePage(): React.JSX.Element {
    switch (activePage) {
      case 'dashboard':   return <DashboardPage />;
      case 'general':     return <GeneralPage />;
      case 'models':      return <ModelsPage />;
      case 'permissions': return <PermissionsPage />;
    }
  }

  return (
    <div>
      <nav>
        <button onClick={() => { setActivePage('dashboard'); }}>Dashboard</button>
        <button onClick={() => { setActivePage('general'); }}>General</button>
        <button onClick={() => { setActivePage('models'); }}>Models</button>
        <button onClick={() => { setActivePage('permissions'); }}>Permissions</button>
      </nav>
      <main>{renderActivePage()}</main>
    </div>
  );
}
