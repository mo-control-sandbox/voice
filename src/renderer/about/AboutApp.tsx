import './AboutApp.css';
import appIconUrl from './assets/app-icon.webp';

/** Displays static application metadata. No IPC required. */
export function AboutApp(): React.JSX.Element {
  return (
    <div className="about-window">
      <div className="about-window__card">
        <img
          className="about-window__icon"
          src={appIconUrl}
          alt="moVoice application icon"
        />

        <div className="about-window__identity">
          <span className="about-window__name">moVoice</span>
          <span className="about-window__version">Version 1.0.0</span>
        </div>

        <div className="about-window__credits">
          <span className="about-window__powered-by">Powered by MoBrowser</span>
        </div>
      </div>
    </div>
  );
}