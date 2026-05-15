import type { AudioInputDevice } from '../../infra/audio/audioDevices';

interface MicrophoneSelectionStepProps {
  readonly audioDevicesLoading: boolean;
  readonly audioDevices: readonly AudioInputDevice[];
  readonly selectedAudioDeviceId: string;
  readonly onAudioDeviceChange: (deviceId: string) => Promise<void>;
}

/**
 * Displays onboarding UI for selecting the recording input device.
 */
export function MicrophoneSelectionStep(props: MicrophoneSelectionStepProps): React.JSX.Element {
  const {
    audioDevicesLoading,
    audioDevices,
    selectedAudioDeviceId,
    onAudioDeviceChange,
  } = props;

  return (
    <section className="welcome-stage">
      <div className="welcome-stage__title-section">
        <h2 className="welcome-stage__title">Select your microphone</h2>
        <p className="welcome-stage__description">Choose the input device used when recording begins.</p>
      </div>
      <div className="welcome-stage__body">
        <div className="welcome-input-card">
          {audioDevicesLoading && (
            <p className="welcome-input-card__hint">Loading microphones...</p>
          )}
          {!audioDevicesLoading && audioDevices.length === 0 && (
            <p className="welcome-input-card__hint">
              No specific microphone detected. You can continue with the system default input.
            </p>
          )}
          {!audioDevicesLoading && audioDevices.length > 0 && (
            <>
              <label htmlFor="welcome-microphone" className="welcome-input-card__label">Input device</label>
              <select
                id="welcome-microphone"
                className="welcome-select welcome-no-drag"
                value={selectedAudioDeviceId}
                onChange={(event) => {
                  void onAudioDeviceChange(event.target.value);
                }}
              >
                <option value="">System default</option>
                {audioDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
