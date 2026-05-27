export const WIZARD_STEPS = [
  'welcome-model',
  'welcome-model-download',
  'microphone-permission',
  'accessibility-permission',
  'microphone-selection',
  'final-shortcut',
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];
export type WizardEventType =
  | 'CONTINUE'
  | 'MIC_GRANTED'
  | 'ACCESSIBILITY_GRANTED'
  | 'MODEL_DOWNLOAD_CANCELLED';

export interface WizardEvent {
  readonly type: WizardEventType;
}

export interface WizardState {
  readonly step: WizardStep;
}

/**
 * Determines onboarding step transitions from explicit events.
 */
export function reduceWizard(state: WizardState, event: WizardEvent): WizardState {
  switch (state.step) {
    case 'welcome-model':
      if (event.type === 'CONTINUE') {
        return { step: 'welcome-model-download' };
      }
      return state;
    case 'welcome-model-download':
      if (event.type === 'MODEL_DOWNLOAD_CANCELLED') {
        return { step: 'welcome-model' };
      }
      if (event.type === 'CONTINUE') {
        return { step: 'microphone-permission' };
      }
      return state;
    case 'microphone-permission':
      if (event.type === 'MIC_GRANTED') {
        return { step: 'accessibility-permission' };
      }
      return state;
    case 'accessibility-permission':
      if (event.type === 'ACCESSIBILITY_GRANTED') {
        return { step: 'microphone-selection' };
      }
      return state;
    case 'microphone-selection':
      if (event.type === 'CONTINUE') {
        return { step: 'final-shortcut' };
      }
      return state;
    case 'final-shortcut':
      return state;
    default:
      return state;
  }
}
