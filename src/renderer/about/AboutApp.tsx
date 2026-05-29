import './AboutApp.css';
import appIconUrl from './assets/app-icon.webp';
import { ipc } from '../gen/ipc';

const MOBROWSER_URL = 'https://teamdev.com/mobrowser';

interface AboutAppProps {
  readonly embedded?: boolean;
}

function openMoBrowser(): void {
  void ipc.desktop.OpenUrl({ url: MOBROWSER_URL });
}

export function AboutApp({ embedded = false }: AboutAppProps = {}): React.JSX.Element {
  return (
    <div className={`about-window ${embedded ? 'about-window--embedded' : ''}`}>
      <div className="about-window__card">
        <button className="about-window__icon-button" onClick={openMoBrowser}>
          <img
            className="about-window__icon"
            src={appIconUrl}
            alt="MōVoice application icon"
          />
        </button>

        <div className="about-window__identity">
          <span className="about-window__name">MōVoice</span>
          <span className="about-window__version">Version 1.0.0</span>
        </div>

        <div className="about-window__credits">
          <span className="about-window__powered-by-label">Powered by&nbsp;</span><button className="about-window__powered-by" onClick={openMoBrowser}>MōBrowser</button>
        </div>
      </div>
    </div>
  );
}
