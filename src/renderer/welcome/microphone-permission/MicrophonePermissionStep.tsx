import { CheckCircle2, CircleAlert, Mic } from 'lucide-react';
import { PermissionStatus } from '../../gen/permissions';
import microphonePermissionPreview from '../assets/microphone-permission.webp';

type FeedbackState = 'idle' | 'loading' | 'success' | 'info';

interface MicrophonePermissionStepProps {
  readonly microphoneFeedback: FeedbackState;
  readonly microphoneStatus: PermissionStatus;
  readonly onRequestPermission: () => Promise<void>;
}

/**
 * Displays onboarding UI for requesting microphone permission.
 */
export function MicrophonePermissionStep(props: MicrophonePermissionStepProps): React.JSX.Element {
  const { microphoneFeedback, microphoneStatus, onRequestPermission } = props;

  return (
    <section className="welcome-stage">
      <div className="welcome-stage__title-section">
        <h2 className="welcome-stage__title">Allow microphone access</h2>
        <p className="welcome-stage__description">
          MōVoice needs your microphone to capture speech.
        </p>
      </div>
      <div className="welcome-stage__body welcome-stage__body--permission">
        <div className="welcome-permission-guide">
          <div className="welcome-status" data-state={microphoneFeedback}>
            {microphoneFeedback === 'success' && <CheckCircle2 size={16} aria-hidden="true" />}
            {microphoneFeedback === 'info' && <CircleAlert size={16} aria-hidden="true" />}
            {(microphoneFeedback === 'idle' || microphoneFeedback === 'loading') && (
              <Mic size={16} aria-hidden="true" />
            )}
            <span>
              {microphoneFeedback === 'success' && 'Microphone permission granted.'}
              {microphoneFeedback === 'loading' && 'Requesting permission...'}
              {microphoneFeedback === 'info' && microphoneStatus === PermissionStatus.PERMISSION_STATUS_GRANTED && 'Permission detected. Preparing next step...'}
              {microphoneFeedback === 'info' && microphoneStatus !== PermissionStatus.PERMISSION_STATUS_GRANTED && 'Permission was not granted. You can try again.'}
              {microphoneFeedback === 'idle' && 'Press the button below to request microphone access.'}
            </span>
          </div>
          <p className="welcome-permission-guide__label">
            Press "Allow" when this dialog pops up
          </p>
          <img
            className="welcome-permission-guide__image"
            src={microphonePermissionPreview}
            alt="macOS dialog asking to allow microphone access for MōVoice"
          />
          {microphoneStatus !== PermissionStatus.PERMISSION_STATUS_GRANTED && (
            <button
              type="button"
              className="welcome-btn welcome-btn--primary welcome-no-drag"
              disabled={microphoneFeedback === 'loading'}
              onClick={() => {
                void onRequestPermission();
              }}
            >
              Request microphone permission
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
