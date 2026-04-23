import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Keyboard, RotateCcw, Loader2 } from 'lucide-react';
import { PermissionStatus, PermissionType, type PermissionStatusProto } from '../gen/permissions';
import { RendererModelCatalog } from '../services/RendererModelCatalog';
import { RendererModelCache } from '../services/RendererModelCache';
import { RendererModelStateStore } from '../services/RendererModelStateStore';
import { RendererModelRepository } from '../services/RendererModelRepository';
import { reportModelReadiness } from '../services/ModelReadinessReporter';
import type { ModelEntry } from '../types/models';
import { ModelCard } from '../settings/components/ModelCard';
import { PermissionRow, type PermissionMeta } from '../settings/components/PermissionRow';
import { PermissionsService } from '../settings/services/PermissionsService';
import { ipc } from '../gen/ipc';
import './WelcomeApp.css';

const MODEL_POLL_INTERVAL_MS = 500;
const PERMISSION_POLL_INTERVAL_MS = 500;
const PERMISSION_POLL_TIMEOUT_MS = 30_000;

const _catalog = new RendererModelCatalog();
const modelRepository = new RendererModelRepository(
  _catalog,
  new RendererModelCache(_catalog.getDefinitions()),
  new RendererModelStateStore(),
);

const permissionsService = new PermissionsService();

const REQUIRED_PERMISSION_TYPES = new Set<PermissionType>([
  PermissionType.PERMISSION_TYPE_MICROPHONE,
  PermissionType.PERMISSION_TYPE_ACCESSIBILITY,
]);

const PERMISSION_META: Partial<Record<PermissionType, PermissionMeta>> = {
  [PermissionType.PERMISSION_TYPE_MICROPHONE]: {
    label: 'Microphone',
    description: 'Allow microphone access so MoVoice can capture your voice.',
    icon: Mic,
  },
  [PermissionType.PERMISSION_TYPE_ACCESSIBILITY]: {
    label: 'Accessibility',
    description: 'Allow Accessibility so MoVoice can paste text into other apps.',
    icon: Keyboard,
  },
};

const FALLBACK_META: PermissionMeta = {
  label: 'Unknown',
  description: '',
  icon: Keyboard,
};

type WizardStep = 'models' | 'permissions';

function hasMissingRequiredPermissions(permissions: readonly PermissionStatusProto[]): boolean {
  return [...REQUIRED_PERMISSION_TYPES].some((type) => {
    const permission = permissions.find((entry) => entry.type === type);
    return permission?.status !== PermissionStatus.PERMISSION_STATUS_GRANTED;
  });
}

/**
 * First-launch onboarding wizard. Guides the user through downloading a speech
 * recognition model and granting the required macOS permissions before first use.
 */
export function WelcomeApp(): React.JSX.Element {
  const [step, setStep] = useState<WizardStep>('models');

  // ── Model state ────────────────────────────────────────────────────────────
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [downloadErrors, setDownloadErrors] = useState<ReadonlyMap<string, string>>(new Map());
  const modelPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshModels = useCallback(async (): Promise<void> => {
    const models = await modelRepository.getModels();
    setModels(models);
    void reportModelReadiness(models);
  }, []);

  useEffect(() => { void refreshModels(); }, [refreshModels]);

  useEffect(() => {
    const hasActiveDownload = models.some((m) => m.downloadProgress !== null);
    if (hasActiveDownload) {
      modelPollRef.current ??= setInterval(() => { void refreshModels(); }, MODEL_POLL_INTERVAL_MS);
    } else {
      if (modelPollRef.current !== null) {
        clearInterval(modelPollRef.current);
        modelPollRef.current = null;
      }
    }
    return () => {
      if (modelPollRef.current !== null) {
        clearInterval(modelPollRef.current);
        modelPollRef.current = null;
      }
    };
  }, [models, refreshModels]);

  const hasDownloadedModel = models.some((m) => m.isDownloaded || m.isActive);

  async function handleDownload(id: string): Promise<void> {
    setDownloadErrors((prev) => { const m = new Map(prev); m.delete(id); return m; });
    void modelRepository
      .download(id, () => { /* progress polled by interval */ })
      .catch((err: unknown) => {
        console.error('[WelcomeApp] Download failed:', err);
        setDownloadErrors((prev) =>
          new Map(prev).set(id, 'Download failed. Check your connection and try again.'),
        );
        void refreshModels();
      });
    await refreshModels();
  }

  async function handleDelete(id: string): Promise<void> {
    await modelRepository.delete(id);
    await refreshModels();
  }

  async function handleSetActive(id: string): Promise<void> {
    await modelRepository.setActiveModel(id);
    await refreshModels();
  }

  // ── Permissions state ──────────────────────────────────────────────────────
  const [permissions, setPermissions] = useState<PermissionStatusProto[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState<PermissionType | null>(null);
  const permPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const permPollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPermissions = useCallback(async (): Promise<void> => {
    const response = await permissionsService.getPermissions();
    setPermissions(response.permissions);
  }, []);

  const clearPermissionPolling = useCallback((): void => {
    if (permPollIntervalRef.current !== null) {
      clearInterval(permPollIntervalRef.current);
      permPollIntervalRef.current = null;
    }
    if (permPollTimeoutRef.current !== null) {
      clearTimeout(permPollTimeoutRef.current);
      permPollTimeoutRef.current = null;
    }
  }, []);

  const refreshPermissionsSnapshot = useCallback(async (): Promise<PermissionStatusProto[]> => {
    const response = await permissionsService.refreshPermissions();
    setPermissions(response.permissions);
    return response.permissions;
  }, []);

  const startPermissionPolling = useCallback((): void => {
    clearPermissionPolling();
    setRefreshing(true);
    let pollInFlight = false;
    const runPoll = async (): Promise<void> => {
      if (pollInFlight) return;
      pollInFlight = true;
      try {
        const latest = await refreshPermissionsSnapshot();
        if (!hasMissingRequiredPermissions(latest)) {
          clearPermissionPolling();
          setRefreshing(false);
        }
      } finally {
        pollInFlight = false;
      }
    };
    void runPoll();
    permPollIntervalRef.current = setInterval(() => { void runPoll(); }, PERMISSION_POLL_INTERVAL_MS);
    permPollTimeoutRef.current = setTimeout(() => {
      clearPermissionPolling();
      setRefreshing(false);
    }, PERMISSION_POLL_TIMEOUT_MS);
  }, [clearPermissionPolling, refreshPermissionsSnapshot]);

  useEffect(() => {
    void loadPermissions().finally(() => { setPermissionsLoading(false); });
  }, [loadPermissions]);

  useEffect(() => {
    return () => { clearPermissionPolling(); };
  }, [clearPermissionPolling]);

  async function handlePermissionRefresh(): Promise<void> {
    clearPermissionPolling();
    setRefreshing(true);
    try {
      await refreshPermissionsSnapshot();
    } finally {
      setRefreshing(false);
    }
  }

  async function handlePermissionAction(permission: PermissionStatusProto): Promise<void> {
    setRequestingPermission(permission.type);
    try {
      if (permission.status === PermissionStatus.PERMISSION_STATUS_DENIED) {
        await permissionsService.openSystemSettings(permission.type);
        startPermissionPolling();
      } else {
        await permissionsService.requestPermission(permission.type);
        await refreshPermissionsSnapshot();
      }
    } finally {
      setRequestingPermission(null);
    }
  }

  // ── Finish ─────────────────────────────────────────────────────────────────
  async function handleFinish(): Promise<void> {
    await ipc.settings.MarkOnboardingComplete({});
    window.close();
  }

  function handleContinue(): void {
    setStep('permissions');
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const visiblePermissions = permissions.filter((p) => REQUIRED_PERMISSION_TYPES.has(p.type));

  return (
    <div className="welcome-app">
      <header className="welcome-header">
        <div className="welcome-header__top">
          <span className="welcome-header__brand">MoVoice</span>
          <div className="welcome-step-indicator" aria-hidden="true">
            <span
              className="welcome-step-dot"
              data-active={step === 'models' ? 'true' : undefined}
            />
            <span
              className="welcome-step-dot"
              data-active={step === 'permissions' ? 'true' : undefined}
            />
          </div>
        </div>

        {step === 'models' && (
          <div className="welcome-step-info">
            <p className="welcome-step-label">Step 1 of 2 — Download a Model</p>
            <p className="welcome-step-description">
              Choose and download a speech recognition model. It runs locally on your Mac.
            </p>
          </div>
        )}
        {step === 'permissions' && (
          <div className="welcome-step-info">
            <p className="welcome-step-label">Step 2 of 2 — Grant Permissions</p>
            <p className="welcome-step-description">
              MoVoice needs a few permissions before it can record and paste for you.
            </p>
          </div>
        )}
      </header>

      <main className="welcome-content">
        {step === 'models' && (
          <div className="welcome-models">
            {models.map((model) => (
              <ModelCard
                key={model.definition.id}
                model={model}
                error={downloadErrors.get(model.definition.id) ?? null}
                onDownload={() => { void handleDownload(model.definition.id); }}
                onDelete={() => { void handleDelete(model.definition.id); }}
                onSetActive={() => { void handleSetActive(model.definition.id); }}
              />
            ))}
          </div>
        )}

        {step === 'permissions' && (
          permissionsLoading ? (
            <div className="welcome-permissions-loading">
              <Loader2 className="welcome-permissions-loading__icon" aria-label="Loading" />
            </div>
          ) : (
            <div className="welcome-permissions__list">
              {visiblePermissions.map((permission) => (
                <PermissionRow
                  key={permission.type}
                  permission={permission}
                  meta={PERMISSION_META[permission.type] ?? FALLBACK_META}
                  isRequesting={requestingPermission === permission.type}
                  onAction={() => { void handlePermissionAction(permission); }}
                />
              ))}
            </div>
          )
        )}
      </main>

      <footer className="welcome-footer">
        {step === 'permissions' && (
          <button
            type="button"
            className="welcome-btn welcome-btn--ghost"
            onClick={() => { setStep('models'); }}
          >
            Back
          </button>
        )}

        <div className="welcome-footer__gap" />

        {step === 'permissions' && (
          <button
            type="button"
            className="welcome-btn welcome-btn--ghost"
            disabled={refreshing}
            onClick={() => { void handlePermissionRefresh(); }}
          >
            <RotateCcw className="welcome-btn__icon" aria-hidden="true" />
            Check again
          </button>
        )}

        {step === 'models' && (
          <button
            type="button"
            className="welcome-btn welcome-btn--primary"
            disabled={!hasDownloadedModel}
            onClick={handleContinue}
          >
            Continue
          </button>
        )}

        {step === 'permissions' && (
          <button
            type="button"
            className="welcome-btn welcome-btn--primary"
            onClick={() => { void handleFinish(); }}
          >
            Get Started
          </button>
        )}
      </footer>
    </div>
  );
}
