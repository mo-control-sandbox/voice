import React from 'react';
import ReactDOM from 'react-dom/client';
import { AboutApp } from './about/AboutApp';
import { startTranscriptionRuntime } from './background/TranscriptionRuntime';
import { HistoryApp } from './history/HistoryApp';
import './index.css';
import { initTheme } from './lib/theme';
import { SettingsApp } from './settings/App';
import { WelcomeApp } from './welcome/WelcomeApp';

type RendererWindowKind = 'about' | 'background' | 'history' | 'settings' | 'welcome';

const RENDERER_WINDOW_PARAM = 'window';

type UiRendererWindowKind = Exclude<RendererWindowKind, 'background'>;

const APP_BY_WINDOW: Record<UiRendererWindowKind, () => React.JSX.Element> = {
  about: AboutApp,
  history: HistoryApp,
  settings: SettingsApp,
  welcome: WelcomeApp,
};

const TITLE_BY_WINDOW: Record<RendererWindowKind, string> = {
  about: 'About MoVoice',
  background: 'MoVoice Background',
  history: 'History',
  settings: 'Settings',
  welcome: 'Welcome to MoVoice',
};

function parseRendererWindowKind(searchParams: URLSearchParams): RendererWindowKind | null {
  const value = searchParams.get(RENDERER_WINDOW_PARAM);
  if (value === 'about' || value === 'background' || value === 'history' || value === 'settings' || value === 'welcome') {
    return value;
  }
  return null;
}

const rendererWindowKind = parseRendererWindowKind(new URLSearchParams(window.location.search));
document.documentElement.dataset.rendererWindow = rendererWindowKind ?? 'unknown';
document.body.dataset.rendererWindow = rendererWindowKind ?? 'unknown';
document.title = rendererWindowKind === null ? 'MoVoice' : TITLE_BY_WINDOW[rendererWindowKind];

initTheme();

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Root element not found. The HTML must contain <div id="root">.');
}
rootElement.dataset.rendererWindowRoot = rendererWindowKind ?? 'unknown';

if (rendererWindowKind === 'background') {
  startTranscriptionRuntime();
} else {
  const App = rendererWindowKind === null ? null : APP_BY_WINDOW[rendererWindowKind];
  const appElement = App === null ? <></> : React.createElement(App);

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      {appElement}
    </React.StrictMode>,
  );
}
