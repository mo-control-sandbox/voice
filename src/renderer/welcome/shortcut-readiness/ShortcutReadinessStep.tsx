import { ChevronRight, Mic } from 'lucide-react';
import { ShortcutKeycaps } from './ShortcutKeycaps';

interface ShortcutReadinessStepProps {
  readonly shortcutKey: string;
}

/**
 * Displays the final onboarding step confirming setup is complete.
 */
export function ShortcutReadinessStep(props: ShortcutReadinessStepProps): React.JSX.Element {
  const { shortcutKey } = props;

  return (
    <section className="welcome-stage welcome-stage__shortcut-readiness">
      <div className="welcome-stage__title-section">
        <span className="welcome-final-stage__icon" aria-hidden="true">
          <Mic />
        </span>
        <h2 className="welcome-stage__title">You are ready to speak</h2>
        <p className="welcome-final-stage__close-hint">
          Everything is configured. Close this window and start using MoVoice right away.
        </p>
      </div>
      <div className="welcome-stage__body welcome-stage__body-final-stage">
        <div className="welcome-final-stage">
          <div className="welcome-final-stage__primary">
            <ShortcutKeycaps shortcut={shortcutKey} large />
            <p className="welcome-final-stage__shortcut-label">your recording shortcut</p>
          </div>

          <div className="welcome-final-stage__or-divider" aria-hidden="true">
            <span>Or try it here</span>
          </div>

          <div className="welcome-final-stage__test">
            <p className="welcome-final-stage__instruction">
              <span className="welcome-final-stage__step">
                <span className="welcome-final-stage__step-badge" aria-hidden="true">1</span>
                <span>Press the shortcut</span>
              </span>
              <ChevronRight className="welcome-final-stage__step-chevron" aria-hidden="true" />
              <span className="welcome-final-stage__step">
                <span className="welcome-final-stage__step-badge" aria-hidden="true">2</span>
                <span>Speak</span>
              </span>
              <ChevronRight className="welcome-final-stage__step-chevron" aria-hidden="true" />
              <span className="welcome-final-stage__step">
                <span className="welcome-final-stage__step-badge" aria-hidden="true">3</span>
                <span>Press it again</span>
              </span>
            </p>
            <div className="welcome-dictation-preview-wrap">
              <textarea
                id="welcome-dictation-preview"
                className="welcome-dictation-preview welcome-no-drag"
                rows={3}
                placeholder="Transcribed text will appear here"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
