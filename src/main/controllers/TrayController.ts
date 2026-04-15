import { app, dock, Tray, Menu, MenuItem, CheckboxMenuItem } from '@mobrowser/api';
import type { WhisperModelSpec, TranscriptionInput, TranscriptionResult } from '../../shared/types';
import type { PreferencesService } from '../services/PreferencesService';
import type { LocalModelService, ModelRuntimeState } from '../services/LocalModelService';
import type { native as NativeBindings } from '../gen/native';
import type { RecordingSessionController } from '../domain/RecordingSessionController';
import type { WindowManager } from './WindowManager';

/** BCP-47 language options shown in the Primary Language submenu. */
const LANGUAGE_OPTIONS: readonly { readonly label: string; readonly value: string }[] = [
  { label: 'Auto-detect', value: 'auto' },
  { label: 'English', value: 'en' },
  { label: 'Ukrainian', value: 'uk' },
  { label: 'Spanish', value: 'es' },
  { label: 'French', value: 'fr' },
  { label: 'German', value: 'de' },
  { label: 'Chinese', value: 'zh' },
  { label: 'Japanese', value: 'ja' },
  { label: 'Korean', value: 'ko' },
  { label: 'Portuguese', value: 'pt' },
];

type WhisperModelEntry = WhisperModelSpec & ModelRuntimeState;

/**
 * Owns the macOS menu-bar tray icon and its context menu.
 * Rebuilds the menu on every state change by calling `refresh()`.
 */
export class TrayController {
  private tray: Tray | null = null;

  constructor(
    private readonly preferences: PreferencesService,
    private readonly localModelService: LocalModelService<
      WhisperModelSpec,
      TranscriptionInput,
      TranscriptionResult
    >,
    private readonly windowManager: WindowManager,
    private readonly controller: RecordingSessionController,
    private readonly native: typeof NativeBindings,
  ) {}

  /** Create the tray icon, build the initial menu, and register the click handler. */
  initialize(): void {
    this.tray = new Tray({
      imagePath: app.getPath('appResources') + '/imageTemplate.png',
    });
    const tray = this.tray;
    this.refresh();
    tray.on('mouseUp', () => {
      tray.openMenu();
    });
  }

  /** Rebuild and apply the full tray menu from current application state. */
  refresh(): void {
    if (this.tray === null) return;

    const state = this.controller.getState();
    const activeModelId = this.preferences.get('activeModelId');
    const primaryLanguage = this.preferences.get('primaryLanguage');

    const whisperModels = this.localModelService.getModels();
    const downloadedModels = whisperModels.filter(m => m.isDownloaded);

    const activeWhisperModel = downloadedModels.find(m => m.id === activeModelId) ?? null;
    const isBuiltinActive = activeModelId === 'builtin';

    // A multilingual model is active when: builtin is always multilingual,
    // or the active Whisper model has isMultilingual === true.
    const isMultilingual = isBuiltinActive || (activeWhisperModel?.isMultilingual ?? false);

    this.tray.setMenu(new Menu({
      items: [
        new MenuItem({
          id: 'startRecording',
          label: 'Start Recording',
          enabled: state === 'idle',
          action: () => { void this.controller.start(); },
        }),
        'separator',
        this.buildModelSubmenu(downloadedModels, activeModelId),
        this.buildLanguageSubmenu(primaryLanguage, isMultilingual),
        'separator',
        new MenuItem({
          id: 'settings',
          label: 'Settings\u2026',
          action: () => { this.windowManager.showSettings(); },
        }),
        new MenuItem({
          id: 'history',
          label: 'History\u2026',
          action: () => { this.windowManager.showHistory(); },
        }),
        new MenuItem({
          id: 'about',
          label: 'About',
          action: () => { this.windowManager.showAbout(); },
        }),
        'separator',
        new CheckboxMenuItem({
          id: 'hideDockIcon',
          label: 'Hide Dock Icon',
          checked: this.preferences.get('hideDockIcon'),
          action: (item: CheckboxMenuItem) => {
            const checked = item.checked ?? false;
            this.preferences.set('hideDockIcon', checked);
            if (checked) { dock.hide(); } else { dock.show(); }
          },
        }),
        new CheckboxMenuItem({
          id: 'launchAtLogin',
          label: 'Launch at Login',
          checked: this.preferences.get('launchAtLogin'),
          action: (item: CheckboxMenuItem) => {
            const checked = item.checked ?? false;
            this.preferences.set('launchAtLogin', checked);
            void this.native.loginItem.SetLaunchAtLogin({ value: checked });
          },
        }),
        'separator',
        new MenuItem({
          id: 'quit',
          label: 'Quit',
          action: () => { app.quit(); },
        }),
      ],
    }));
  }

  private buildModelSubmenu(
    downloadedModels: WhisperModelEntry[],
    activeModelId: string,
  ): Menu {
    const builtinItem = new CheckboxMenuItem({
      id: 'model-builtin',
      label: 'Built-in macOS Recognition',
      checked: activeModelId === 'builtin',
      action: () => {
        void this.localModelService.setActiveModel('builtin');
      },
    });

    const modelItems = downloadedModels.map(
      model => new CheckboxMenuItem({
        id: `model-${model.id}`,
        label: model.label,
        checked: model.id === activeModelId,
        action: () => {
          void this.localModelService.setActiveModel(model.id);
        },
      }),
    );

    return new Menu({
      label: 'Select Model',
      items: [builtinItem, ...modelItems],
    });
  }

  private buildLanguageSubmenu(
    currentLanguage: string,
    isMultilingual: boolean,
  ): Menu | MenuItem {
    // `MenuOptions` has no `enabled` property, so when language selection does not
    // apply (single-language model active), render a disabled placeholder `MenuItem`
    // instead of the full submenu.
    if (!isMultilingual) {
      return new MenuItem({
        id: 'primaryLanguageDisabled',
        label: 'Primary Language',
        enabled: false,
      });
    }

    const items = LANGUAGE_OPTIONS.map(
      opt => new CheckboxMenuItem({
        id: `lang-${opt.value}`,
        label: opt.label,
        checked: currentLanguage === opt.value,
        action: () => {
          this.preferences.set('primaryLanguage', opt.value);
          this.refresh();
        },
      }),
    );

    return new Menu({
      label: 'Primary Language',
      items,
    });
  }
}
