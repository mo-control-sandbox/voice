import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { initializeSentry } from './sentry';
import { AboutApp } from './about/AboutApp';
import { startTranscriptionRuntime } from './recording/transcription/TranscriptionRuntime';
import './index.css';
import { initTheme } from './theme';
import { App } from './settings/App';
import { WelcomeApp } from './welcome/WelcomeApp';

type RendererWindowKind = 'about' | 'app' | 'background' | 'welcome';

const RENDERER_WINDOW_PARAM = 'window';

type UiRendererWindowKind = Exclude<RendererWindowKind, 'background'>;

const APP_BY_WINDOW: Record<UiRendererWindowKind, () => React.JSX.Element> = {
  about: AboutApp,
  app: App,
  welcome: WelcomeApp,
};

const TITLE_BY_WINDOW: Record<RendererWindowKind, string> = {
  about: 'About MōVoice',
  app: 'MōVoice',
  background: 'MōVoice Background',
  welcome: 'Welcome to MōVoice',
};

function parseRendererWindowKind(searchParams: URLSearchParams): RendererWindowKind | null {
  const value = searchParams.get(RENDERER_WINDOW_PARAM);
  if (value === 'about' || value === 'app' || value === 'background' || value === 'welcome') {
    return value;
  }
  return null;
}

const rendererWindowKind = parseRendererWindowKind(new URLSearchParams(window.location.search));
document.documentElement.dataset.rendererWindow = rendererWindowKind ?? 'unknown';
document.body.dataset.rendererWindow = rendererWindowKind ?? 'unknown';
document.title = rendererWindowKind === null ? 'MōVoice' : TITLE_BY_WINDOW[rendererWindowKind];

void initializeSentry().catch((error: unknown) => {
  console.warn('Sentry init failed', error);
});

initTheme();

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Root element not found. The HTML must contain <div id="root">.');
}
rootElement.dataset.rendererWindowRoot = rendererWindowKind ?? 'unknown';

if (rendererWindowKind === 'background') {
  startTranscriptionRuntime();
} else {
  const SelectedApp = rendererWindowKind === null ? null : APP_BY_WINDOW[rendererWindowKind];
  const appElement = SelectedApp === null ? <></> : React.createElement(SelectedApp);

  ReactDOM.createRoot(rootElement, {
    onCaughtError: Sentry.reactErrorHandler(),
    onRecoverableError: Sentry.reactErrorHandler(),
    onUncaughtError: Sentry.reactErrorHandler(),
  }).render(
    <React.StrictMode>
      {appElement}
    </React.StrictMode>,
  );
}
