import { WIZARD_STEPS } from './flow';
import { useWelcomeController } from './useWelcomeController';
import { ModelSelectionStep } from './model-selection/ModelSelectionStep';
import { MicrophonePermissionStep } from './microphone-permission/MicrophonePermissionStep';
import { AccessibilityPermissionStep } from './accessibility-permission/AccessibilityPermissionStep';
import { MicrophoneSelectionStep } from './microphone-selection/MicrophoneSelectionStep';
import { ShortcutReadinessStep } from './shortcut-readiness/ShortcutReadinessStep';
import { WelcomeProgressFooter } from './shared/WelcomeProgressFooter';
import './WelcomeApp.css';

/**
 * First-launch onboarding wizard that collects required setup for recording.
 */
export function WelcomeApp(): React.JSX.Element {
  const { state, actions } = useWelcomeController();

  return (
    <div className="welcome-wizard">
      <main className="welcome-wizard__content">
        {state.step === 'welcome-model' && (
          <ModelSelectionStep
            models={state.models}
            downloadingModelId={state.downloadingModelId}
            warmingUpModelId={state.warmingUpModelId}
            downloadErrors={state.downloadErrors}
            onDownload={actions.handleModelDownload}
            onDelete={actions.handleModelCancel}
          />
        )}

        {state.step === 'microphone-permission' && (
          <MicrophonePermissionStep
            microphoneFeedback={state.microphoneFeedback}
            microphoneStatus={state.microphoneStatus}
            onRequestPermission={actions.handleRequestMicrophonePermission}
          />
        )}

        {state.step === 'accessibility-permission' && (
          <AccessibilityPermissionStep
            accessibilityFeedback={state.accessibilityFeedback}
            accessibilityStatus={state.accessibilityStatus}
            onOpenSystemSettings={actions.handleOpenAccessibilitySettings}
          />
        )}

        {state.step === 'microphone-selection' && (
          <MicrophoneSelectionStep
            audioDevicesLoading={state.audioDevicesLoading}
            audioDevices={state.audioDevices}
            selectedAudioDeviceId={state.selectedAudioDeviceId}
            onAudioDeviceChange={actions.handleAudioDeviceChange}
          />
        )}

        {state.step === 'final-shortcut' && (
          <ShortcutReadinessStep shortcutKey={state.shortcutKey} />
        )}
      </main>

      <WelcomeProgressFooter
        steps={WIZARD_STEPS}
        step={state.step}
        stepIndex={state.stepIndex}
        canContinue={state.canContinue}
        settingsLoaded={state.settingsLoaded}
        showContinue={state.showContinue}
        showClose={state.step === 'final-shortcut'}
        onContinue={actions.moveToNextStep}
        onClose={() => { window.close(); }}
      />
    </div>
  );
}
