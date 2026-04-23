import './AboutApp.css';
import appIconUrl from './assets/app-icon.webp';
import { ipc } from '../gen/ipc';

const MOBROWSER_URL = 'https://teamdev.com/mobrowser';

function openMoBrowser(): void {
  void ipc.desktop.OpenUrl({ url: MOBROWSER_URL });
}

/** Displays static application metadata. No IPC required. */
export function AboutApp(): React.JSX.Element {
  return (
    <div className="about-window">
      <div className="about-window__card">
        <button className="about-window__icon-button" onClick={openMoBrowser}>
          <img
            className="about-window__icon"
            src={appIconUrl}
            alt="moVoice application icon"
          />
        </button>

        <div className="about-window__identity">
          <span className="about-window__name">moVoice</span>
          <span className="about-window__version">Version 1.0.0</span>
        </div>

        <div className="about-window__credits">
          <span className="about-window__powered-by-label">Powered by </span><button className="about-window__powered-by" onClick={openMoBrowser}>MōBrowser</button>
        </div>
      </div>
    </div>
  );
}