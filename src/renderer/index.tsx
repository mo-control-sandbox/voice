import React from 'react';
import ReactDOM from 'react-dom/client';
import { AboutApp } from './about/AboutApp';
import { HistoryApp } from './history/HistoryApp';
import './index.css';
import { initTheme } from './lib/theme';
import { RecordingApp } from './recording/RecordingApp';
import { SettingsApp } from './settings/App';

type RendererWindowKind = 'about' | 'history' | 'recording' | 'settings';

const RENDERER_WINDOW_PARAM = 'window';

const APP_BY_WINDOW: Record<RendererWindowKind, () => React.JSX.Element> = {
  about: AboutApp,
  history: HistoryApp,
  recording: RecordingApp,
  settings: SettingsApp,
};

const TITLE_BY_WINDOW: Record<RendererWindowKind, string> = {
  about: 'About moVoice',
  history: 'moVoice - History',
  recording: 'moVoice',
  settings: 'moVoice - Settings',
};

function parseRendererWindowKind(searchParams: URLSearchParams): RendererWindowKind | null {
  const value = searchParams.get(RENDERER_WINDOW_PARAM);
  if (value === 'about' || value === 'history' || value === 'recording' || value === 'settings') {
    return value;
  }
  return null;
}

const rendererWindowKind = parseRendererWindowKind(new URLSearchParams(window.location.search));
document.documentElement.dataset.rendererWindow = rendererWindowKind ?? 'unknown';
document.body.dataset.rendererWindow = rendererWindowKind ?? 'unknown';
document.title = rendererWindowKind === null ? 'moVoice' : TITLE_BY_WINDOW[rendererWindowKind];

initTheme();

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Root element not found. The HTML must contain <div id="root">.');
}
rootElement.dataset.rendererWindowRoot = rendererWindowKind ?? 'unknown';

const App = rendererWindowKind === null ? null : APP_BY_WINDOW[rendererWindowKind];
const appElement = App === null ? <></> : React.createElement(App);

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    {appElement}
  </React.StrictMode>,
);
