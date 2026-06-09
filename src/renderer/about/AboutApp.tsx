import './AboutApp.css';
import { useEffect, useState } from 'react';
import appIconUrl from './assets/app-icon.webp';
import mobrowserIconUrl from './assets/mobrowser-icon.webp';
import { ipc } from '../gen/ipc';

const MOBROWSER_URL = 'https://teamdev.com/mobrowser/';
const TEAMDEV_URL = 'https://teamdev.com';
const PRIVACY_URL = 'https://teamdev.com/terms-and-privacy/';

interface AboutAppProps {
  readonly embedded?: boolean;
}

function getCurrentYear(): number {
  return new Date().getFullYear();
}

function openMoBrowser(): void {
  void ipc.desktop.OpenUrl({ url: MOBROWSER_URL });
}

function openTeamDev(): void {
  void ipc.desktop.OpenUrl({ url: TEAMDEV_URL });
}

function openPrivacy(): void {
  void ipc.desktop.OpenUrl({ url: PRIVACY_URL });
}

export function AboutApp({ embedded = false }: AboutAppProps = {}): React.JSX.Element {
  const [version, setVersion] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadApplicationMetadata(): Promise<void> {
      const metadata = await ipc.applicationMetadata.GetApplicationMetadata({});
      if (isMounted) {
        setVersion(metadata.version);
      }
    }

    void loadApplicationMetadata().catch(() => {
      if (isMounted) {
        setVersion('');
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className={`about-window ${embedded ? 'about-window--embedded' : ''}`}>
      <div className="about-window__content">
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
            {version !== '' && <span className="about-window__version">Version {version} (Apple Silicon)</span>}
          </div>
        </div>
        <div className="about-window__mobrowser-card">
          <img
              className="about-window__icon"
              src={mobrowserIconUrl}
              alt="MōVoice application icon"
          />
          <div className="about-window__mobrowser-details">
            <p className="about-window__powered-by-label">Powered by</p>
            <p className="about-window__mobrowser-name">MōBrowser</p>
            <p className="about-window__mobrowser-description">A framework for building cross-platform desktop apps with TypeScript.</p>
            <button className="about-window__mobrowser-link" onClick={openMoBrowser}>Visit website</button>
          </div>
        </div>
      </div>
      <div className="about-window__copyright">
        <span>© {getCurrentYear()} <button onClick={openTeamDev}>TeamDev</button>. All rights reserved. <button onClick={openPrivacy}>Terms and privacy</button>.</span>
      </div>
    </div>
  );
}
