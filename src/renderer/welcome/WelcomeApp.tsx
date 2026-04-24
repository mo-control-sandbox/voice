import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, Download, Settings2, X } from 'lucide-react';
import { PermissionStatus, PermissionType, type PermissionStatusProto } from '../gen/permissions';
import { ipc } from '../gen/ipc';
import type { ModelEntry } from '../types/models';
import { RendererModelCatalog } from '../services/RendererModelCatalog';
import { OPFSModelCache } from '../services/OPFSModelCache';
import { RendererModelStateStore } from '../services/RendererModelStateStore';
import { RendererModelRepository } from '../services/RendererModelRepository';
import { reportModelReadiness } from '../services/ModelReadinessReporter';
import { PermissionsService } from '../settings/services/PermissionsService';
import { SettingsService } from '../settings/services/SettingsService';
import microphonePermissionPreview from './assets/microphone-permission.webp';
import './WelcomeApp.css';

const MODEL_POLL_INTERVAL_MS = 500;
const ACCESSIBILITY_POLL_INTERVAL_MS = 700;
const AUTO_ADVANCE_DELAY_MS = 900;

const catalog = new RendererModelCatalog();
const modelRepository = new RendererModelRepository(
  catalog,
  new OPFSModelCache(catalog.getDefinitions()),
  new RendererModelStateStore(),
);
const permissionsService = new PermissionsService();
const settingsService = new SettingsService();

const WIZARD_STEPS = [
  'welcome-model',
  'microphone-permission',
  'accessibility-permission',
  'microphone-selection',
  'final-shortcut',
] as const;

type WizardStep = (typeof WIZARD_STEPS)[number];
type FeedbackState = 'idle' | 'loading' | 'success' | 'info';
interface LoadAudioDevicesOptions {
  readonly showLoading?: boolean;
}
type WizardEventType = 'CONTINUE' | 'MODEL_READY' | 'MIC_GRANTED' | 'ACCESSIBILITY_GRANTED';
interface WizardEvent {
  readonly type: WizardEventType;
}
interface WizardState {
  readonly step: WizardStep;
}

/**
 * Determines wizard stage transitions from explicit events.
 */
function reduceWizard(state: WizardState, event: WizardEvent): WizardState {
  switch (state.step) {
    case 'welcome-model':
      if (event.type === 'CONTINUE' || event.type === 'MODEL_READY') {
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

/**
 * Enumerates available audio input devices after a permission-safe warm-up.
 */
async function getAudioInputDevices(): Promise<readonly { deviceId: string; label: string }[]> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    stream.getTracks().forEach((track) => { track.stop(); });
  } catch {
    return [];
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === 'audioinput')
    .filter((device) => device.deviceId.trim() !== '')
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label.trim() !== '' ? device.label : `Microphone ${String(index + 1)}`,
    }));
}

/**
 * Returns the requested permission status from a permissions snapshot.
 */
function findPermissionStatus(
  permissions: readonly PermissionStatusProto[],
  type: PermissionType,
): PermissionStatus {
  const permission = permissions.find((entry) => entry.type === type);
  return permission?.status ?? PermissionStatus.PERMISSION_STATUS_UNSPECIFIED;
}

/**
 * Formats model size using GB for values at or above 1 GB, otherwise MB.
 */
function formatModelSize(fileSizeBytes: number): string {
  if (fileSizeBytes >= 1_000_000_000) {
    const sizeGb = fileSizeBytes / 1_000_000_000;
    const rounded = Math.round(sizeGb * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)} GB`;
  }
  return `${String(Math.round(fileSizeBytes / 1_000_000))} MB`;
}

/**
 * Renders a shortcut accelerator as a row of keycap-style tokens.
 */
function ShortcutKeycaps({ shortcut, large = false }: { shortcut: string; large?: boolean }): React.JSX.Element {
  const tokens = shortcut.split('+').filter((token) => token.trim() !== '');
  const visibleTokens = tokens.map((token): { symbol: string; label: string } => {
    if (token === 'CommandOrControl' || token === 'Command') return { symbol: '⌘', label: 'Command' };
    if (token === 'Control') return { symbol: '⌃', label: 'Control' };
    if (token === 'Alt') return { symbol: '⌥', label: 'Option' };
    if (token === 'Shift') return { symbol: '⇧', label: 'Shift' };
    if (token === 'Space') return { symbol: '␣', label: 'Space' };
    return { symbol: token, label: token };
  });

  return (
    <div
      className={`shortcut-keycaps ${large ? 'shortcut-keycaps--large' : ''}`}
      aria-label={`Shortcut ${shortcut}`}
    >
      {visibleTokens.map((token, index) => (
        <kbd key={`${token.label}-${String(index)}`} className="shortcut-keycaps__key">
          <span className="shortcut-keycaps__symbol">{token.symbol}</span>
          <span className="shortcut-keycaps__label">{token.label}</span>
        </kbd>
      ))}
    </div>
  );
}

/**
 * First-launch onboarding wizard that collects required setup for recording.
 */
export function WelcomeApp(): React.JSX.Element {
  const [wizard, dispatchWizard] = useReducer(reduceWizard, { step: 'welcome-model' as const });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [downloadErrors, setDownloadErrors] = useState<ReadonlyMap<string, string>>(new Map());
  const [microphoneStatus, setMicrophoneStatus] = useState<PermissionStatus>(
    PermissionStatus.PERMISSION_STATUS_UNSPECIFIED,
  );
  const [accessibilityStatus, setAccessibilityStatus] = useState<PermissionStatus>(
    PermissionStatus.PERMISSION_STATUS_UNSPECIFIED,
  );
  const [microphoneFeedback, setMicrophoneFeedback] = useState<FeedbackState>('idle');
  const [accessibilityFeedback, setAccessibilityFeedback] = useState<FeedbackState>('idle');
  const [audioDevices, setAudioDevices] = useState<readonly { deviceId: string; label: string }[]>([]);
  const [audioDevicesLoading, setAudioDevicesLoading] = useState(false);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState('');
  const [shortcutKey, setShortcutKey] = useState('CommandOrControl+Shift+Space');
  const [onboardingMarked, setOnboardingMarked] = useState(false);

  const modelPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const accessibilityPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalStageTextAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const hasLoadedAudioDevicesRef = useRef(false);

  const step = wizard.step;
  const stepIndex = WIZARD_STEPS.indexOf(step);
  const hasReadyActiveModel = useMemo(
    () => models.some((model) => model.isActive && model.isDownloaded && model.downloadProgress === null),
    [models],
  );
  const downloadingModelId = useMemo(
    () => models.find((model) => model.downloadProgress !== null)?.definition.id ?? null,
    [models],
  );

  const canContinue = useMemo((): boolean => {
    if (step === 'welcome-model') return hasReadyActiveModel;
    if (step === 'microphone-selection') return audioDevices.length > 0;
    return false;
  }, [audioDevices.length, hasReadyActiveModel, step]);

  const clearAutoAdvance = useCallback((): void => {
    if (autoAdvanceRef.current !== null) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
  }, []);

  const moveToNextStep = useCallback((): void => {
    dispatchWizard({ type: 'CONTINUE' });
  }, []);

  const scheduleAutoAdvance = useCallback((eventType: WizardEventType): void => {
    clearAutoAdvance();
    autoAdvanceRef.current = setTimeout(() => {
      autoAdvanceRef.current = null;
      dispatchWizard({ type: eventType });
    }, AUTO_ADVANCE_DELAY_MS);
  }, [clearAutoAdvance]);

  const refreshModels = useCallback(async (): Promise<void> => {
    const latestModels = await modelRepository.getModels();
    setModels(latestModels);
    void reportModelReadiness(latestModels);
  }, []);

  const refreshPermissions = useCallback(async (): Promise<void> => {
    const response = await permissionsService.refreshPermissions();
    setMicrophoneStatus(findPermissionStatus(response.permissions, PermissionType.PERMISSION_TYPE_MICROPHONE));
    setAccessibilityStatus(findPermissionStatus(response.permissions, PermissionType.PERMISSION_TYPE_ACCESSIBILITY));
  }, []);

  const loadAudioDevices = useCallback(async (options?: LoadAudioDevicesOptions): Promise<void> => {
    const showLoading = options?.showLoading ?? !hasLoadedAudioDevicesRef.current;
    if (showLoading) {
      setAudioDevicesLoading(true);
    }
    try {
      const devices = await getAudioInputDevices();
      setAudioDevices(devices);
      if (devices.length > 0) {
        const selectedExists = devices.some((device) => device.deviceId === selectedAudioDeviceId);
        if (!selectedExists && selectedAudioDeviceId !== '') {
          setSelectedAudioDeviceId('');
          await settingsService.setAudioInputDevice('');
        }
      }
    } finally {
      hasLoadedAudioDevicesRef.current = true;
      if (showLoading) {
        setAudioDevicesLoading(false);
      }
    }
  }, [selectedAudioDeviceId]);

  useEffect(() => {
    void Promise.all([
      refreshModels(),
      permissionsService.getPermissions().then((response) => {
        setMicrophoneStatus(findPermissionStatus(response.permissions, PermissionType.PERMISSION_TYPE_MICROPHONE));
        setAccessibilityStatus(findPermissionStatus(response.permissions, PermissionType.PERMISSION_TYPE_ACCESSIBILITY));
      }),
      settingsService.getSettings().then((settings) => {
        setSelectedAudioDeviceId(settings.audioInputDeviceId);
        setShortcutKey(settings.shortcutKey);
      }),
    ]).finally(() => {
      setSettingsLoaded(true);
    });
  }, [refreshModels]);

  useEffect(() => {
    const hasActiveDownload = models.some((model) => model.downloadProgress !== null);
    if (hasActiveDownload) {
      modelPollingRef.current ??= setInterval(() => { void refreshModels(); }, MODEL_POLL_INTERVAL_MS);
    } else if (modelPollingRef.current !== null) {
      clearInterval(modelPollingRef.current);
      modelPollingRef.current = null;
    }

    return () => {
      if (modelPollingRef.current !== null) {
        clearInterval(modelPollingRef.current);
        modelPollingRef.current = null;
      }
    };
  }, [models, refreshModels]);

  useEffect(() => {
    if (step === 'welcome-model' && hasReadyActiveModel && downloadingModelId === null) {
      scheduleAutoAdvance('MODEL_READY');
      return;
    }
    if (step === 'welcome-model') {
      clearAutoAdvance();
    }
  }, [clearAutoAdvance, downloadingModelId, hasReadyActiveModel, scheduleAutoAdvance, step]);

  useEffect(() => {
    if (step !== 'accessibility-permission') {
      if (accessibilityPollingRef.current !== null) {
        clearInterval(accessibilityPollingRef.current);
        accessibilityPollingRef.current = null;
      }
      return;
    }

    const runPoll = async (): Promise<void> => {
      const response = await permissionsService.refreshPermissions();
      const latestAccessibility = findPermissionStatus(
        response.permissions,
        PermissionType.PERMISSION_TYPE_ACCESSIBILITY,
      );
      setAccessibilityStatus(latestAccessibility);
      if (latestAccessibility === PermissionStatus.PERMISSION_STATUS_GRANTED) {
        setAccessibilityFeedback('success');
        if (accessibilityPollingRef.current !== null) {
          clearInterval(accessibilityPollingRef.current);
          accessibilityPollingRef.current = null;
        }
        scheduleAutoAdvance('ACCESSIBILITY_GRANTED');
      }
    };

    void runPoll();
    accessibilityPollingRef.current = setInterval(() => { void runPoll(); }, ACCESSIBILITY_POLL_INTERVAL_MS);
    return () => {
      if (accessibilityPollingRef.current !== null) {
        clearInterval(accessibilityPollingRef.current);
        accessibilityPollingRef.current = null;
      }
    };
  }, [scheduleAutoAdvance, step]);

  useEffect(() => {
    if (step === 'microphone-selection' && microphoneStatus === PermissionStatus.PERMISSION_STATUS_GRANTED) {
      void loadAudioDevices({ showLoading: !hasLoadedAudioDevicesRef.current });
      const onDeviceChange = (): void => { void loadAudioDevices({ showLoading: false }); };
      navigator.mediaDevices.addEventListener('devicechange', onDeviceChange);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange);
      };
    }
    return undefined;
  }, [loadAudioDevices, microphoneStatus, step]);

  useEffect(() => {
    if (step === 'final-shortcut') {
      finalStageTextAreaRef.current?.focus();
    }
  }, [step]);

  useEffect(() => {
    if (step !== 'final-shortcut' || onboardingMarked) return;

    void ipc.settings.MarkOnboardingComplete({}).then(() => {
      setOnboardingMarked(true);
    });
  }, [onboardingMarked, step]);

  useEffect(() => {
    return () => {
      if (modelPollingRef.current !== null) clearInterval(modelPollingRef.current);
      if (accessibilityPollingRef.current !== null) clearInterval(accessibilityPollingRef.current);
      clearAutoAdvance();
    };
  }, [clearAutoAdvance]);

  async function handleModelDownload(id: string): Promise<void> {
    if (downloadingModelId !== null && downloadingModelId !== id) return;
    setDownloadErrors((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    void (async () => {
      try {
        await modelRepository.download(id, () => {
          /* model progress updates through polling */
        });
        await modelRepository.setActiveModel(id);
      } catch (error: unknown) {
        console.error('[WelcomeApp] Model download failed:', error);
        setDownloadErrors((prev) => new Map(prev).set(id, 'Download failed. Try again.'));
      } finally {
        await refreshModels();
      }
    })();
    await refreshModels();
  }

  async function handleModelCancel(id: string): Promise<void> {
    if (downloadingModelId !== null) return;
    await modelRepository.delete(id);
    await refreshModels();
  }

  async function handleRequestMicrophonePermission(): Promise<void> {
    setMicrophoneFeedback('loading');
    clearAutoAdvance();
    try {
      await permissionsService.requestPermission(PermissionType.PERMISSION_TYPE_MICROPHONE);
      const response = await permissionsService.refreshPermissions();
      const latestMicrophone = findPermissionStatus(response.permissions, PermissionType.PERMISSION_TYPE_MICROPHONE);
      setMicrophoneStatus(latestMicrophone);
      setAccessibilityStatus(findPermissionStatus(response.permissions, PermissionType.PERMISSION_TYPE_ACCESSIBILITY));

      if (latestMicrophone === PermissionStatus.PERMISSION_STATUS_GRANTED) {
        setMicrophoneFeedback('success');
        scheduleAutoAdvance('MIC_GRANTED');
      } else {
        setMicrophoneFeedback('info');
      }
    } catch {
      setMicrophoneFeedback('info');
    }
  }

  async function handleOpenAccessibilitySettings(): Promise<void> {
    try {
      await permissionsService.requestPermission(PermissionType.PERMISSION_TYPE_ACCESSIBILITY);
      await refreshPermissions();
    } catch {}
  }

  async function handleAudioDeviceChange(deviceId: string): Promise<void> {
    setSelectedAudioDeviceId(deviceId);
    await settingsService.setAudioInputDevice(deviceId);
  }

  return (
    <div className="welcome-wizard">
      <main className="welcome-wizard__content">
        {step === 'welcome-model' && (
          <section className="welcome-stage">
            <h2 className="welcome-stage__title">Choose a model for MoVoice to download</h2>
            <p className="welcome-stage__description">
              You can change it later in Settings.
            </p>
            <div className="welcome-stage__body welcome-stage__body--static">
              <div className="welcome-model-list">
                {models.map((model) => (
                  <article
                    key={model.definition.id}
                    className="welcome-model-tile welcome-no-drag"
                    data-disabled={downloadingModelId !== null && downloadingModelId !== model.definition.id ? 'true' : undefined}
                    data-downloaded={model.isDownloaded ? 'true' : undefined}
                  >
                    <h3 className="welcome-model-card__name">{model.definition.label}</h3>
                    <span className="welcome-model-tile__tag">
                      {model.definition.isMultilingual ? 'Polyglot' : 'English'}
                    </span>
                    <div className="welcome-model-tile__statusbar">
                      <span className="welcome-model-tile__size">{formatModelSize(model.definition.fileSizeBytes)}</span>
                      <span className="welcome-model-tile__tools">
                        {model.downloadProgress !== null && (
                          <>
                            <span
                              className="welcome-model-tile__progress"
                              style={{ background: `conic-gradient(var(--primary) ${String(Math.round(model.downloadProgress * 100))}%, color-mix(in oklch, var(--muted) 70%, var(--background)) 0)` }}
                              aria-label={`Downloading ${String(Math.round(model.downloadProgress * 100))}%`}
                            />
                            <button
                              type="button"
                              className="welcome-model-tile__icon-btn welcome-model-tile__icon-btn--danger welcome-no-drag"
                              disabled
                              aria-label={`Downloading ${model.definition.label}`}
                            >
                              <X size={14} aria-hidden="true" />
                            </button>
                          </>
                        )}
                        {model.downloadProgress === null && !model.isDownloaded && (
                          <button
                            type="button"
                            className="welcome-model-tile__icon-btn welcome-no-drag"
                            disabled={downloadingModelId !== null}
                            onClick={() => { void handleModelDownload(model.definition.id); }}
                            aria-label={`Download ${model.definition.label}`}
                          >
                            <Download size={14} aria-hidden="true" />
                          </button>
                        )}
                        {model.downloadProgress === null && model.isDownloaded && (
                          <button
                            type="button"
                            className="welcome-model-tile__icon-btn welcome-model-tile__icon-btn--danger welcome-no-drag"
                            disabled={downloadingModelId !== null}
                            onClick={() => { void handleModelCancel(model.definition.id); }}
                            aria-label={`Cancel ${model.definition.label}`}
                          >
                            <X size={14} aria-hidden="true" />
                          </button>
                        )}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
              <div className="welcome-model-actions">
                {downloadErrors.size > 0 && (
                  <p className="welcome-model-card__error">{downloadErrors.values().next().value}</p>
                )}
              </div>
            </div>
          </section>
        )}

        {step === 'microphone-permission' && (
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
                    onClick={() => { void handleRequestMicrophonePermission(); }}
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
        )}

        {step === 'accessibility-permission' && (
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
                    onClick={() => { void handleOpenAccessibilitySettings(); }}
                  >
                    Open System Settings
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {step === 'microphone-selection' && (
          <section className="welcome-stage">
            <h2 className="welcome-stage__title">Select your microphone</h2>
            <p className="welcome-stage__description">
              Choose the input device used when recording begins.
            </p>
            <div className="welcome-stage__body">
              <div className="welcome-input-card">
                {audioDevicesLoading && (
                  <p className="welcome-input-card__hint">Loading microphones...</p>
                )}
                {!audioDevicesLoading && audioDevices.length === 0 && (
                  <p className="welcome-input-card__hint">No microphones detected. Connect one and reopen this step.</p>
                )}
                {!audioDevicesLoading && audioDevices.length > 0 && (
                  <>
                    <label htmlFor="welcome-microphone" className="welcome-input-card__label">Input device</label>
                    <select
                      id="welcome-microphone"
                      className="welcome-select welcome-no-drag"
                      value={selectedAudioDeviceId}
                      onChange={(event) => { void handleAudioDeviceChange(event.target.value); }}
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
        )}

        {step === 'final-shortcut' && (
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
                  ref={finalStageTextAreaRef}
                  id="welcome-dictation-preview"
                  className="welcome-dictation-preview welcome-no-drag"
                  rows={4}
                  placeholder="Transcribed text will appear here"
                />
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="welcome-wizard__footer">
        <div className="welcome-progress" aria-label={`Step ${String(stepIndex + 1)} of ${String(WIZARD_STEPS.length)}`}>
          {WIZARD_STEPS.map((wizardStep, index) => (
            <span
              key={wizardStep}
              className="welcome-progress__dot"
              data-active={wizardStep === step ? 'true' : undefined}
              data-complete={index < stepIndex ? 'true' : undefined}
            />
          ))}
          <span className="welcome-progress__label">
            Step {String(stepIndex + 1)} of {String(WIZARD_STEPS.length)}
          </span>
        </div>
        <div className="welcome-wizard__footer-actions">
          {step !== 'microphone-permission' && step !== 'accessibility-permission' && step !== 'final-shortcut' && (
            <button
              type="button"
              className="welcome-btn welcome-btn--primary welcome-no-drag"
              disabled={!canContinue || !settingsLoaded}
              onClick={moveToNextStep}
            >
              Continue
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
