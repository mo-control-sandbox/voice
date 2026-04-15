import type { JSX } from 'react';
import { ThemeProvider } from './components/theme-provider';
import { RecordingApp } from './components/recording/RecordingApp';
import { SettingsApp } from './components/settings/SettingsApp';
import { HistoryApp } from './components/history/HistoryApp';
import { AboutApp } from './components/about/AboutApp';

function resolveWindow(): JSX.Element | null {
  const hash = window.location.hash.split('?')[0];
  switch (hash) {
    case '#recording': return <RecordingApp />;
    case '#settings':  return <SettingsApp />;
    case '#history':   return <HistoryApp />;
    case '#about':     return <AboutApp />;
    default:           return null;
  }
}

function App(): JSX.Element {
  return (
    <ThemeProvider defaultTheme="system" storageKey="movoice-theme">
      {resolveWindow()}
    </ThemeProvider>
  );
}

export default App;
