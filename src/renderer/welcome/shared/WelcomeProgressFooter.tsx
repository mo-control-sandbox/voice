import type { WizardStep } from '../flow';

interface WelcomeProgressFooterProps {
  readonly steps: readonly WizardStep[];
  readonly step: WizardStep;
  readonly stepIndex: number;
  readonly canContinue: boolean;
  readonly settingsLoaded: boolean;
  readonly showContinue: boolean;
  readonly showClose: boolean;
  readonly onContinue: () => void;
  readonly onClose: () => void;
}

/**
 * Displays onboarding progress and Continue action.
 */
export function WelcomeProgressFooter(props: WelcomeProgressFooterProps): React.JSX.Element {
  const {
    steps,
    step,
    stepIndex,
    canContinue,
    settingsLoaded,
    showContinue,
    showClose,
    onContinue,
    onClose,
  } = props;

  return (
    <footer className="welcome-wizard__footer">
      <div className="welcome-progress" aria-label={`Step ${String(stepIndex + 1)} of ${String(steps.length)}`}>
        {steps.map((wizardStep, index) => (
          <span
            key={wizardStep}
            className="welcome-progress__dot"
            data-active={wizardStep === step ? 'true' : undefined}
            data-complete={index < stepIndex ? 'true' : undefined}
          />
        ))}
        <span className="welcome-progress__label">
          Step {String(stepIndex + 1)} of {String(steps.length)}
        </span>
      </div>
      <div className="welcome-wizard__footer-actions">
        {showContinue && (
          <button
            type="button"
            className="welcome-btn welcome-btn--primary welcome-no-drag"
            disabled={!canContinue || !settingsLoaded}
            onClick={onContinue}
          >
            Continue
          </button>
        )}
        {showClose && (
          <button
            type="button"
            className="welcome-btn welcome-btn--primary welcome-no-drag"
            onClick={onClose}
          >
            Close
          </button>
        )}
      </div>
    </footer>
  );
}
