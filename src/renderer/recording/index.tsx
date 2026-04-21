import React from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import { initTheme } from '../lib/theme';
import { RecordingApp } from './RecordingApp';

initTheme();

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Root element not found. The HTML must contain <div id="root">.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <RecordingApp />
  </React.StrictMode>,
);
