import React from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';
import { RecordingApp } from './RecordingApp';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Root element not found. The HTML must contain <div id="root">.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <RecordingApp />
  </React.StrictMode>,
);
