import { ShortcutKeycaps } from './ShortcutKeycaps';

interface ShortcutReadinessStepProps {
  readonly shortcutKey: string;
}

/**
 * Displays the final onboarding step with shortcut usage instructions.
 */
export function ShortcutReadinessStep(props: ShortcutReadinessStepProps): React.JSX.Element {
  const { shortcutKey } = props;

  return (
    <section className="welcome-stage">
      <h2 className="welcome-stage__title">You are ready to speak</h2>
      <div className="welcome-stage__body">
        <div className="welcome-final-stage">
          <p className="welcome-final-stage__instruction">
            <span className="welcome-final-stage__step">
              <span className="welcome-final-stage__step-badge" aria-hidden="true">1</span>
              <span>Press the shortcut</span>
            </span>
            <span className="welcome-final-stage__step">
              <span className="welcome-final-stage__step-badge" aria-hidden="true">2</span>
              <span>Speak</span>
            </span>
            <span className="welcome-final-stage__step">
              <span className="welcome-final-stage__step-badge" aria-hidden="true">3</span>
              <span>Press it again</span>
            </span>
          </p>
          <ShortcutKeycaps shortcut={shortcutKey} large />
          <textarea
            id="welcome-dictation-preview"
            className="welcome-dictation-preview welcome-no-drag"
            rows={4}
            placeholder="Transcribed text will appear here"
            autoFocus
          />
        </div>
      </div>
    </section>
  );
}
