import { useRef } from 'react';
import { Switch } from '../components/Switch';
import { PREDEFINED_SHORTCUTS, useGeneralController } from '../controllers/useGeneralController';
import './GeneralPage.css';

interface GeneralPageProps {
  readonly onOpenPermissions: () => void;
}

/**
 * General settings -- audio input, global shortcut, and privacy preferences.
 */
export function GeneralPage({ onOpenPermissions }: GeneralPageProps): React.JSX.Element {
  const {
    state: {
      devices,
      selectedDeviceId,
      shortcutKey,
      saveTranscripts,
      saveAudio,
      showWindowOnAppLaunch,
      isCapturing,
      isShortcutLoading,
      isMicLoading,
      isMicPermissionActionLoading,
      isMicPermissionPolling,
      isMicPermissionGranted,
      isMicPermissionDenied,
    },
    actions: {
      setIsCapturing,
      saveShortcut,
      handleDeviceChange,
      handleSaveTranscripts,
      handleSaveAudio,
      handleShowWindowOnAppLaunch,
      handleMicPermissionAction,
    },
  } = useGeneralController();

  const captureRef = useRef<HTMLButtonElement>(null);

  const isPredefined = PREDEFINED_SHORTCUTS.some((shortcut) => shortcut.value === shortcutKey);
  const customLabel = !isPredefined && shortcutKey !== '' ? shortcutKey : null;
  const micPermissionTitle = isMicPermissionDenied
    ? 'Microphone access is off'
    : 'Microphone access is needed';
  const micPermissionDescription = isMicPermissionDenied
    ? 'Open System Settings and enable microphone access for MoVoice, then return here.'
    : 'Allow microphone access to choose your input device.';
  const micPermissionButtonLabel = isMicPermissionDenied ? 'Open System Settings...' : 'Allow Access';
  const isMicPermissionButtonDisabled = isMicPermissionActionLoading || isMicPermissionPolling;

  return (
    <div className="general-page">
      <h1 className="general-page__heading">General</h1>

      <section className="general-section">
        <span className="general-section__label">Privacy</span>
        <div className="general-section__card">
          <div className="toggle-row">
            <label htmlFor="save-transcripts" className="toggle-row__label">
              Save transcripts
            </label>
            <Switch
              id="save-transcripts"
              checked={saveTranscripts}
              onChange={(value) => {
                void handleSaveTranscripts(value);
              }}
            />
          </div>
          <div className="toggle-row">
            <label htmlFor="save-audio" className="toggle-row__label">
              Save audio
            </label>
            <Switch
              id="save-audio"
              checked={saveAudio}
              onChange={(value) => {
                void handleSaveAudio(value);
              }}
            />
          </div>
        </div>
      </section>

      <section className="general-section">
        <span className="general-section__label">Behavior</span>
        <div className="general-section__card">
          <div className="toggle-row">
            <label htmlFor="show-window-on-app-launch" className="toggle-row__label">
              Show this window on app launch
            </label>
            <Switch
              id="show-window-on-app-launch"
              checked={showWindowOnAppLaunch}
              onChange={(value) => {
                void handleShowWindowOnAppLaunch(value);
              }}
            />
          </div>
        </div>
      </section>

      <section className="general-section">
        <span className="general-section__label">Input</span>
        {isMicLoading ? (
          <div className="general-skeleton" />
        ) : !isMicPermissionGranted ? (
          <div className="general-permission-card">
            <span className="general-permission-card__title">{micPermissionTitle}</span>
            <span className="general-permission-card__description">
              {micPermissionDescription}
            </span>
            <button
              type="button"
              className="general-permission-card__link"
              disabled={isMicPermissionButtonDisabled}
              onClick={() => {
                void handleMicPermissionAction();
              }}
            >
              {isMicPermissionPolling ? 'Checking...' : micPermissionButtonLabel}
            </button>
          </div>
        ) : devices.length === 0 ? (
          <div className="general-permission-card">
            <span className="general-permission-card__title">No microphone devices available</span>
            <span className="general-permission-card__description">
              Open the Permissions page and allow microphone access, then return here.
            </span>
            <button
              type="button"
              className="general-permission-card__link"
              onClick={onOpenPermissions}
            >
              Open Permissions
            </button>
          </div>
        ) : (
          <div className="general-section__card">
            <div className="general-field">
              <label htmlFor="mic-select" className="toggle-row__label">Microphone</label>
              <select
                id="mic-select"
                className="device-select"
                value={selectedDeviceId}
                onChange={(event) => {
                  void handleDeviceChange(event.target.value);
                }}
              >
                <option value="">System default</option>
                {devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </section>

      <section className="general-section">
        <span className="general-section__label">Shortcut</span>
        {isShortcutLoading ? (
          <div className="general-skeleton" />
        ) : (
          <div className="general-section__card">
            <div className="shortcut-section">
              <div className="shortcut-presets">
                {PREDEFINED_SHORTCUTS.map((shortcut) => (
                  <button
                    key={shortcut.value}
                    type="button"
                    className="shortcut-preset"
                    data-active={shortcutKey === shortcut.value ? 'true' : undefined}
                    onClick={() => {
                      void saveShortcut(shortcut.value);
                    }}
                  >
                    {shortcut.label}
                  </button>
                ))}
              </div>
              <div className="shortcut-capture-row">
                <button
                  ref={captureRef}
                  type="button"
                  className="shortcut-capture"
                  data-state={isCapturing ? 'capturing' : undefined}
                  onClick={() => {
                    setIsCapturing(true);
                    captureRef.current?.focus();
                  }}
                >
                  {isCapturing ? 'Press a key... (Esc to cancel)' : 'Custom...'}
                </button>
                {customLabel !== null && (
                  <span className="shortcut-custom-value">{customLabel}</span>
                )}
              </div>
              {shortcutKey !== '' && (
                <span className="shortcut-summary">
                  Active shortcut: <span className="shortcut-summary__value">{shortcutKey}</span>
                </span>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
