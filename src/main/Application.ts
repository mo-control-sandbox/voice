import * as path from 'node:path';
import { app, dock, ipc } from '@mobrowser/api';
import { native } from './gen/native';
import { PreferencesService } from './services/PreferencesService';
import { SessionFileManager } from './services/SessionFileManager';
import { HistoryStore } from './services/HistoryStore';
import { StatsCalculator } from './services/StatsCalculator';
import { WhisperModelCatalog } from './services/WhisperModelCatalog';
// TEMPORARY — see InlineTransformersJsBackend.ts for context.
import { InlineTransformersJsBackend } from './services/InlineTransformersJsBackend';
import { LocalModelService } from './services/LocalModelService';
import { BuiltinSpeechTranscriptionService } from './services/BuiltinSpeechTranscriptionService';
import { TranscriptionRouter } from './services/TranscriptionRouter';
import { PasteCoordinator } from './services/PasteCoordinator';
import { RecordingSessionController } from './domain/RecordingSessionController';
import { WindowManager } from './controllers/WindowManager';
import { ShortcutManager } from './services/ShortcutManager';
import { TrayController } from './controllers/TrayController';
import { NotificationService } from './services/NotificationService';
import { RecordingIpcService } from './ipc/RecordingIpcService';
import { SettingsIpcService } from './ipc/SettingsIpcService';
import { ModelIpcService } from './ipc/ModelIpcService';
import { HistoryIpcService } from './ipc/HistoryIpcService';
import { PermissionsIpcService } from './ipc/PermissionsIpcService';
import { StatsIpcService } from './ipc/StatsIpcService';
import { AppInfoIpcService } from './ipc/AppInfoIpcService';
import {
  RecordingService,
  SettingsService,
  ModelService,
  HistoryService,
  PermissionsService,
  StatsService,
  AppInfoService,
} from './gen/ipc_service';
import type { WhisperModelSpec, TranscriptionInput, TranscriptionResult } from '../shared/types';

/** Bundle identifier of this application, defined in mobrowser.conf.json. */
const OWN_BUNDLE_ID = 'com.company.moVoice';

/** Default sub-directory name under userData for model storage. */
const DEFAULT_MODELS_SUBDIR = 'models';

/**
 * Application composition root.
 * Instantiates all services in dependency order, wires cross-service callbacks,
 * registers IPC services, and executes the startup sequence.
 */
export class Application {
  /** Retained so that `shutdown()` can unregister the global shortcut. */
  private shortcutManager!: ShortcutManager;

  /**
   * Full startup sequence. Must be called once after construction.
   * Throws on unrecoverable initialisation failures (steps 1–6 of §2.7).
   * Steps 7–8 are non-fatal and log errors without propagating.
   */
  async initialize(): Promise<void> {
    const userData = app.getPath('userData');
    const resourcesPath = app.getPath('appResources');

    // ── 1. Preferences ────────────────────────────────────────────────────────────
    // PreferencesService reads from the MōBrowser prefs store lazily — no load()
    // call required. Preferences are available immediately.
    const preferences = new PreferencesService();

    // ── 2. Seed modelStoragePath ──────────────────────────────────────────────────
    // On first run the stored path is an empty string (the PREFERENCE_DEFAULT).
    // Resolve a concrete path and persist it before LocalModelService reads it.
    if (!preferences.get('modelStoragePath')) {
      preferences.set('modelStoragePath', path.join(userData, DEFAULT_MODELS_SUBDIR));
    }

    // ── Core infrastructure ───────────────────────────────────────────────────────
    const sessionFileManager = new SessionFileManager(userData);
    const historyStore = new HistoryStore(userData, sessionFileManager);
    historyStore.initialize();

    const statsCalculator = new StatsCalculator();
    const whisperCatalog = new WhisperModelCatalog(resourcesPath);
    // TEMPORARY — replace with TransformersJsBackend once the MōBrowser worker bug is fixed.
    const backend = new InlineTransformersJsBackend();

    // ── Local model service ───────────────────────────────────────────────────────
    const localModelService = new LocalModelService<
      WhisperModelSpec,
      TranscriptionInput,
      TranscriptionResult
    >(
      whisperCatalog.getAll(),
      backend,
      () => preferences.get('modelStoragePath'),
      (newPath) => { preferences.set('modelStoragePath', newPath); },
      () => preferences.get('activeModelId'),
      (modelId) => { preferences.set('activeModelId', modelId); },
    );

    // ── Transcription layer ───────────────────────────────────────────────────────
    const builtinSpeechService = new BuiltinSpeechTranscriptionService(native.builtinSpeech);
    const transcriptionRouter = new TranscriptionRouter(
      localModelService,
      builtinSpeechService,
      preferences,
    );

    // ── OS integration ────────────────────────────────────────────────────────────
    const pasteCoordinator = new PasteCoordinator(native, OWN_BUNDLE_ID);
    const notificationService = new NotificationService();
    const recordingController = new RecordingSessionController(
      transcriptionRouter,
      pasteCoordinator,
      historyStore,
      sessionFileManager,
      preferences,
      native,
      notificationService,
    );

    const windowManager = new WindowManager(app.url);
    const shortcutManager = new ShortcutManager(recordingController);
    this.shortcutManager = shortcutManager;

    const trayController = new TrayController(
      preferences,
      localModelService,
      windowManager,
      recordingController,
      native,
    );

    // ── IPC services ──────────────────────────────────────────────────────────────
    const recordingIpcService = new RecordingIpcService(recordingController);
    const settingsIpcService = new SettingsIpcService(preferences, shortcutManager, native);
    const modelIpcService = new ModelIpcService(localModelService);
    const historyIpcService = new HistoryIpcService(historyStore, sessionFileManager);
    const permissionsIpcService = new PermissionsIpcService(native);
    const statsIpcService = new StatsIpcService(historyStore, statsCalculator);
    const appInfoIpcService = new AppInfoIpcService();

    // ── Wire cross-service callbacks ──────────────────────────────────────────────
    // Recording window closed without an explicit cancel (e.g. OS force-close) → cancel.
    windowManager.onRecordingWindowClosed(() => {
      recordingController.cancel();
    });

    // FSM state changes drive window visibility and tray menu rebuilds.
    recordingController.onStateChange((state) => {
      if (state === 'recording') {
        windowManager.showRecordingWindow();
      } else if (state === 'processing') {
        windowManager.transitionRecordingWindowToProcessing();
      } else {
        windowManager.hideRecordingWindow();
      }
      trayController.refresh();
    });

    // Active model changes persist the new selection and rebuild the tray menu.
    localModelService.onActiveModelChanged(() => {
      trayController.refresh();
    });

    // ── Register IPC services ─────────────────────────────────────────────────────
    ipc.registerService(RecordingService(recordingIpcService));
    ipc.registerService(SettingsService(settingsIpcService));
    ipc.registerService(ModelService(modelIpcService));
    ipc.registerService(HistoryService(historyIpcService));
    ipc.registerService(PermissionsService(permissionsIpcService));
    ipc.registerService(StatsService(statsIpcService));
    ipc.registerService(AppInfoService(appInfoIpcService));

    // ── 3. Tray ───────────────────────────────────────────────────────────────────
    trayController.initialize();

    // ── 4. Dock ───────────────────────────────────────────────────────────────────
    if (preferences.get('hideDockIcon')) {
      dock.hide();
    }

    // ── 5. Local model service ────────────────────────────────────────────────────
    localModelService.initialize();

    // ── 6. Global shortcut ────────────────────────────────────────────────────────
    shortcutManager.register(preferences.get('shortcutKey'));

    // ── 7. Warm-up (non-fatal) ────────────────────────────────────────────────────
    try {
      await localModelService.warmUp();
    } catch (err) {
      console.error('[moVoice] Model warm-up failed — will retry on first recording:', err);
    }

    // ── 8. First-run permissions bootstrap (non-fatal) ────────────────────────────
    if (app.launchInfo.isFirstRun) {
      windowManager.showSettings('permissions');
    }
  }

  /** Release the global keyboard shortcut. Call when the application is quitting. */
  shutdown(): void {
    this.shortcutManager.unregister();
  }
}
