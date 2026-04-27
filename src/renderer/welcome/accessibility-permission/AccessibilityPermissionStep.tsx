import { CheckCircle2, CircleAlert, Settings2 } from 'lucide-react';
import { PermissionStatus } from '../../gen/permissions';

type FeedbackState = 'idle' | 'loading' | 'success' | 'info';

interface AccessibilityPermissionStepProps {
  readonly accessibilityFeedback: FeedbackState;
  readonly accessibilityStatus: PermissionStatus;
  readonly onOpenSystemSettings: () => Promise<void>;
}

/**
 * Displays onboarding UI for granting accessibility permission.
 */
export function AccessibilityPermissionStep(props: AccessibilityPermissionStepProps): React.JSX.Element {
  const {
    accessibilityFeedback,
    accessibilityStatus,
    onOpenSystemSettings,
  } = props;

  return (
    <section className="welcome-stage">
      <h2 className="welcome-stage__title">Allow Accessibility access</h2>
      <p className="welcome-stage__description">
        Accessibility permission lets MoVoice paste transcription into the app you were using.
      </p>
      <div className="welcome-stage__body welcome-stage__body--permission">
        <div className="welcome-permission-guide">
          <div className="welcome-permission-shell__visual" aria-hidden="true">
            <span className="welcome-permission-shell__caption">Dummy screenshot placeholder</span>
            <span className="welcome-permission-shell__title">System Settings region preview</span>
          </div>
          <div className="welcome-status" data-state={accessibilityFeedback}>
            {accessibilityFeedback === 'success' && <CheckCircle2 size={16} aria-hidden="true" />}
            {accessibilityFeedback === 'info' && <CircleAlert size={16} aria-hidden="true" />}
            {(accessibilityFeedback === 'idle' || accessibilityFeedback === 'loading') && (
              <Settings2 size={16} aria-hidden="true" />
            )}
            <span>
              {accessibilityFeedback === 'success' && 'Accessibility permission granted.'}
              {accessibilityFeedback === 'loading' && 'Opening System Settings...'}
              {accessibilityFeedback === 'info' && accessibilityStatus === PermissionStatus.PERMISSION_STATUS_GRANTED && 'Permission detected. Preparing next step...'}
              {accessibilityFeedback === 'info' && accessibilityStatus !== PermissionStatus.PERMISSION_STATUS_GRANTED && 'After enabling access, return here. Status is checked automatically.'}
              {accessibilityFeedback === 'idle' && 'Waiting for Accessibility permission.'}
            </span>
          </div>
          <p className="welcome-permission-guide__label">
            Open System Settings and enable MoVoice in Accessibility.
          </p>
          {accessibilityStatus !== PermissionStatus.PERMISSION_STATUS_GRANTED && (
            <button
              type="button"
              className="welcome-btn welcome-btn--primary welcome-no-drag"
              disabled={accessibilityFeedback === 'loading'}
              onClick={() => {
                void onOpenSystemSettings();
              }}
            >
              Open System Settings
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
