import './AboutApp.css';

/** Displays static application metadata. No IPC required. */
export function AboutApp(): React.JSX.Element {
  return (
    <div className="about-window">
      <div className="about-window__card">
        <img
          className="about-window__icon"
          src="../../assets/app.icns"
          alt="moVoice app icon"
        />

        <div className="about-window__identity">
          <h1 className="about-window__name">moVoice</h1>
          <p className="about-window__version">Version 1.0.0</p>
        </div>

        <div className="about-window__credits">
          <p className="about-window__author">By Vladyslav Lubenskyi</p>
          <p className="about-window__powered-by">Powered by MōBrowser</p>
        </div>
      </div>
    </div>
  );
}
