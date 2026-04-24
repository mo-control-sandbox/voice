import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, Download, Mic, Settings2, X } from 'lucide-react';
import { PermissionStatus, PermissionType, type PermissionStatusProto } from '../gen/permissions';
import { ipc } from '../gen/ipc';
import type { ModelEntry } from '../types/models';
import { RendererModelCatalog } from '../services/RendererModelCatalog';
import { RendererModelCache } from '../services/RendererModelCache';
import { RendererModelStateStore } from '../services/RendererModelStateStore';
import { RendererModelRepository } from '../services/RendererModelRepository';
import { reportModelReadiness } from '../services/ModelReadinessReporter';
import { PermissionsService } from '../settings/services/PermissionsService';
import { SettingsService } from '../settings/services/SettingsService';
import './WelcomeApp.css';

const MODEL_POLL_INTERVAL_MS = 500;
const ACCESSIBILITY_POLL_INTERVAL_MS = 700;
const AUTO_ADVANCE_DELAY_MS = 900;

const catalog = new RendererModelCatalog();
const modelRepository = new RendererModelRepository(
  catalog,
  new RendererModelCache(catalog.getDefinitions()),
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

/**
 * Converts a keyboard event into a MoBrowser shortcut accelerator string.
 */
function buildAccelerator(event: KeyboardEvent): string | null {
  const modifierKeys = new Set(['Meta', 'Control', 'Shift', 'Alt', 'Command']);
  if (modifierKeys.has(event.key)) return null;

  const parts: string[] = [];
  if (event.metaKey) parts.push('Command');
  if (event.ctrlKey) parts.push('Control');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (parts.length === 0) return null;

  let key = event.key;
  if (key === ' ') key = 'Space';
  else if (key.length === 1) key = key.toUpperCase();

  parts.push(key);
  return parts.join('+');
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
    return `${Number.isInteger(rounded) ? String(rounded.toFixed(0)) : String(rounded.toFixed(1))} GB`;
  }
  return `${String(Math.round(fileSizeBytes / 1_000_000))} MB`;
}

/**
 * Renders a shortcut accelerator as a row of keycap-style tokens.
 */
function ShortcutKeycaps({ shortcut }: { shortcut: string }): React.JSX.Element {
  const tokens = shortcut.split('+').filter((token) => token.trim() !== '');
  const visibleTokens = tokens.map((token) => {
    if (token === 'CommandOrControl') return 'Cmd';
    if (token === 'Command') return 'Cmd';
    if (token === 'Control') return 'Ctrl';
    if (token === 'Alt') return 'Option';
    return token;
  });

  return (
    <div className="shortcut-keycaps" aria-label={`Shortcut ${shortcut}`}>
      {visibleTokens.map((token, index) => (
        <kbd key={`${token}-${String(index)}`} className="shortcut-keycaps__key">{token}</kbd>
      ))}
    </div>
  );
}

/**
 * First-launch onboarding wizard that collects required setup for recording.
 */
export function WelcomeApp(): React.JSX.Element {
  const [step, setStep] = useState<WizardStep>('welcome-model');
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
  const [shortcutHint, setShortcutHint] = useState('Press a shortcut combination');
  const [isShortcutFocused, setIsShortcutFocused] = useState(false);
  const [onboardingMarked, setOnboardingMarked] = useState(false);

  const modelPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const accessibilityPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shortcutInputRef = useRef<HTMLInputElement | null>(null);

  const stepIndex = WIZARD_STEPS.indexOf(step);
  const hasReadyDownloadedModel = useMemo(
    () => models.some((model) => model.isDownloaded && model.downloadProgress === null),
    [models],
  );
  const downloadingModelId = useMemo(
    () => models.find((model) => model.downloadProgress !== null)?.definition.id ?? null,
    [models],
  );

  const canContinue = useMemo((): boolean => {
    if (step === 'welcome-model') return hasReadyDownloadedModel;
    if (step === 'microphone-selection') return audioDevices.length > 0;
    return false;
  }, [audioDevices.length, hasReadyDownloadedModel, step]);

  const clearAutoAdvance = useCallback((): void => {
    if (autoAdvanceRef.current !== null) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
  }, []);

  const moveToNextStep = useCallback((): void => {
    setStep((currentStep) => {
      const currentIndex = WIZARD_STEPS.indexOf(currentStep);
      if (currentIndex >= WIZARD_STEPS.length - 1) return currentStep;
      return WIZARD_STEPS[currentIndex + 1];
    });
  }, []);

  const scheduleAutoAdvance = useCallback((nextStep: WizardStep): void => {
    clearAutoAdvance();
    autoAdvanceRef.current = setTimeout(() => {
      setStep(nextStep);
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

  const loadAudioDevices = useCallback(async (): Promise<void> => {
    setAudioDevicesLoading(true);
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
      setAudioDevicesLoading(false);
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
    if (step === 'welcome-model' && hasReadyDownloadedModel && downloadingModelId === null) {
      scheduleAutoAdvance('microphone-permission');
      return;
    }
    if (step === 'welcome-model') {
      clearAutoAdvance();
    }
  }, [clearAutoAdvance, downloadingModelId, hasReadyDownloadedModel, scheduleAutoAdvance, step]);

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
        scheduleAutoAdvance('microphone-selection');
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
      void loadAudioDevices();
      const onDeviceChange = (): void => { void loadAudioDevices(); };
      navigator.mediaDevices.addEventListener('devicechange', onDeviceChange);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange);
      };
    }
    return undefined;
  }, [loadAudioDevices, microphoneStatus, step]);

  useEffect(() => {
    if (step === 'final-shortcut') {
      shortcutInputRef.current?.focus();
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
      if (isShortcutFocused) {
        void settingsService.setShortcutCaptureMode(false);
      }
    };
  }, [clearAutoAdvance, isShortcutFocused]);

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
        scheduleAutoAdvance('accessibility-permission');
      } else {
        setMicrophoneFeedback('info');
      }
    } catch {
      setMicrophoneFeedback('info');
    }
  }

  async function handleOpenAccessibilitySettings(): Promise<void> {
    setAccessibilityFeedback('loading');
    clearAutoAdvance();
    try {
      await permissionsService.openSystemSettings(PermissionType.PERMISSION_TYPE_ACCESSIBILITY);
      setAccessibilityFeedback('info');
      await refreshPermissions();
    } catch {
      setAccessibilityFeedback('info');
    }
  }

  async function handleAudioDeviceChange(deviceId: string): Promise<void> {
    setSelectedAudioDeviceId(deviceId);
    await settingsService.setAudioInputDevice(deviceId);
  }

  async function handleShortcutFocus(): Promise<void> {
    setIsShortcutFocused(true);
    setShortcutHint('Press keys now. Escape cancels.');
    await settingsService.setShortcutCaptureMode(true);
  }

  async function handleShortcutBlur(): Promise<void> {
    setIsShortcutFocused(false);
    setShortcutHint('Press a shortcut combination');
    await settingsService.setShortcutCaptureMode(false);
  }

  async function handleShortcutKeyDown(event: React.KeyboardEvent<HTMLInputElement>): Promise<void> {
    event.preventDefault();
    if (event.key === 'Escape') {
      setShortcutHint('Shortcut capture cancelled');
      return;
    }

    const accelerator = buildAccelerator(event.nativeEvent);
    if (accelerator === null) {
      setShortcutHint('Include at least one modifier key');
      return;
    }

    setShortcutKey(accelerator);
    setShortcutHint('Shortcut updated');
    await settingsService.setShortcutKey(accelerator);
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
              moVoice needs your microphone to capture speech before transcription begins.
            </p>
            <div className="welcome-stage__body">
              <div className="welcome-permission-shell">
                <div className="welcome-permission-shell__visual" aria-hidden="true">
                  <span className="welcome-permission-shell__caption">Dummy screenshot placeholder</span>
                  <span className="welcome-permission-shell__title">macOS microphone dialog preview</span>
                </div>
                <div className="welcome-permission-shell__body">
                  <div className="welcome-status" data-state={microphoneFeedback}>
                    {microphoneFeedback === 'success' && <CheckCircle2 size={16} aria-hidden="true" />}
                    {microphoneFeedback === 'info' && <CircleAlert size={16} aria-hidden="true" />}
                    {microphoneFeedback === 'idle' && <Mic size={16} aria-hidden="true" />}
                    {microphoneFeedback === 'loading' && <Mic size={16} aria-hidden="true" />}
                    <span>
                      {microphoneFeedback === 'success' && 'Microphone permission granted.'}
                      {microphoneFeedback === 'loading' && 'Requesting permission...'}
                      {microphoneFeedback === 'info' && 'Permission not granted yet. Please try again.'}
                      {microphoneFeedback === 'idle' && 'Press the button to request permission.'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="welcome-btn welcome-btn--primary welcome-no-drag"
                    disabled={microphoneFeedback === 'loading'}
                    onClick={() => { void handleRequestMicrophonePermission(); }}
                  >
                    Request Microphone Permission
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {step === 'accessibility-permission' && (
          <section className="welcome-stage">
            <h2 className="welcome-stage__title">Allow Accessibility access</h2>
            <p className="welcome-stage__description">
              Accessibility permission lets moVoice paste transcription into the app you were using.
            </p>
            <div className="welcome-stage__body">
              <div className="welcome-permission-shell">
                <div className="welcome-permission-shell__visual" aria-hidden="true">
                  <span className="welcome-permission-shell__caption">Dummy screenshot placeholder</span>
                  <span className="welcome-permission-shell__title">System Settings region preview</span>
                </div>
                <div className="welcome-permission-shell__body">
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
                      {accessibilityFeedback === 'idle' && 'Open System Settings and enable moVoice in Accessibility.'}
                    </span>
                  </div>
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
            <h2 className="welcome-stage__title">You are ready to dictate</h2>
            <p className="welcome-stage__description">
              Default shortcut shown below. You can set a custom shortcut now or later in Settings.
            </p>
            <div className="welcome-stage__body">
              <div className="welcome-final-card">
                <div className="welcome-final-card__row">
                  <span className="welcome-final-card__label">Current shortcut</span>
                  <ShortcutKeycaps shortcut={shortcutKey} />
                </div>
                <div className="welcome-final-card__row welcome-final-card__row--stack">
                  <label htmlFor="welcome-shortcut-input" className="welcome-final-card__label">Set custom shortcut</label>
                  <input
                    ref={shortcutInputRef}
                    id="welcome-shortcut-input"
                    className="welcome-shortcut-input welcome-no-drag"
                    value={shortcutKey}
                    readOnly
                    onFocus={() => { void handleShortcutFocus(); }}
                    onBlur={() => { void handleShortcutBlur(); }}
                    onKeyDown={(event) => { void handleShortcutKeyDown(event); }}
                  />
                  <span className="welcome-final-card__hint">{shortcutHint}</span>
                </div>
                <p className="welcome-final-card__try">
                  Try it now: focus any text field, press your shortcut, and start dictating.
                </p>
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
          {step === 'final-shortcut' && (
            <span className="welcome-wizard__ready">Setup completed. Close this window to start using moVoice.</span>
          )}
        </div>
      </footer>
    </div>
  );
}
