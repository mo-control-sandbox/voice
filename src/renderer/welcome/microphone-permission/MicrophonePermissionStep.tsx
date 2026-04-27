import microphonePermissionPreview from '../assets/microphone-permission.webp';

type FeedbackState = 'idle' | 'loading' | 'success' | 'info';

interface MicrophonePermissionStepProps {
  readonly microphoneFeedback: FeedbackState;
  readonly onRequestPermission: () => Promise<void>;
}

/**
 * Displays onboarding UI for requesting microphone permission.
 */
export function MicrophonePermissionStep(props: MicrophonePermissionStepProps): React.JSX.Element {
  const { microphoneFeedback, onRequestPermission } = props;

  return (
    <section className="welcome-stage">
      <h2 className="welcome-stage__title">Allow microphone access</h2>
      <p className="welcome-stage__description">
        MoVoice needs your microphone to capture speech.
      </p>
      <div className="welcome-stage__body welcome-stage__body--permission">
        <div className="welcome-permission-guide">
          <div className="welcome-stage__bottom-action">
            <button
              type="button"
              className="welcome-btn welcome-btn--friendly welcome-no-drag"
              disabled={microphoneFeedback === 'loading'}
              onClick={() => {
                void onRequestPermission();
              }}
            >
              Press to request microphone permissions
            </button>
          </div>
          <p className="welcome-permission-guide__label">
            Press "Allow" when this dialog pops up
          </p>
          <img
            className="welcome-permission-guide__image"
            src={microphonePermissionPreview}
            alt="macOS dialog asking to allow microphone access for MoVoice"
          />
        </div>
      </div>
    </section>
  );
}
