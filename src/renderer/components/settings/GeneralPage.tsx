import type { JSX } from 'react';
import type { PreferencesProto } from '@/gen/settings';
import type { ModelEntryProto } from '@/gen/model';
import { ipc } from '@/gen/ipc';
import { ShortcutConfigurator } from './ShortcutConfigurator';

/** BCP-47 language codes offered in the primary language dropdown. */
const LANGUAGES: readonly { code: string; label: string }[] = [
  { code: 'auto',  label: 'Auto-detect' },
  { code: 'en',    label: 'English' },
  { code: 'es',    label: 'Spanish' },
  { code: 'fr',    label: 'French' },
  { code: 'de',    label: 'German' },
  { code: 'it',    label: 'Italian' },
  { code: 'pt',    label: 'Portuguese' },
  { code: 'ru',    label: 'Russian' },
  { code: 'zh',    label: 'Chinese' },
  { code: 'ja',    label: 'Japanese' },
  { code: 'ko',    label: 'Korean' },
  { code: 'ar',    label: 'Arabic' },
  { code: 'nl',    label: 'Dutch' },
  { code: 'pl',    label: 'Polish' },
  { code: 'tr',    label: 'Turkish' },
  { code: 'uk',    label: 'Ukrainian' },
];

interface ToggleRowProps {
  readonly label: string
  readonly description: string
  readonly checked: boolean
  readonly onChange: (value: boolean) => void
}

function ToggleRow({ label, description, checked, onChange }: ToggleRowProps): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => { onChange(!checked); }}
        className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
          checked ? 'bg-primary' : 'bg-muted'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

interface GeneralPageProps {
  readonly prefs: PreferencesProto
  readonly models: ModelEntryProto[]
  readonly onChanged: () => void
}

/**
 * General settings page: global shortcut, behaviour toggles, and language
 * preference.
 */
export function GeneralPage({ prefs, models, onChanged }: GeneralPageProps): JSX.Element {
  const activeModel = models.find((m) => m.isActive) ?? null;
  const languageEnabled = activeModel?.isMultilingual === true;

  const setPref = (key: string, value: boolean | string): void => {
    ipc.settings.SetPreference({ key, value: JSON.stringify(value) })
      .then(onChanged)
      .catch((err: unknown) => { console.error('[GeneralPage] SetPreference error:', err); });
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">General</h2>
      </div>

      <div className="space-y-6">
        {/* Global Shortcut */}
        <section className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground mb-3">Global shortcut</p>
          <ShortcutConfigurator
            currentShortcut={prefs.shortcutKey}
            onChange={(shortcut) => { setPref('shortcutKey', shortcut); }}
          />
        </section>

        {/* Behaviour Toggles */}
        <section className="rounded-lg border border-border bg-card px-4">
          <ToggleRow
            label="Hide Dock icon"
            description="Keep moVoice out of the Dock; access it from the menu bar only."
            checked={prefs.hideDockIcon}
            onChange={(v) => { setPref('hideDockIcon', v); }}
          />
          <ToggleRow
            label="Launch at Login"
            description="Start moVoice automatically when you log in."
            checked={prefs.launchAtLogin}
            onChange={(v) => { setPref('launchAtLogin', v); }}
          />
          <ToggleRow
            label="Don't save transcripts"
            description="Transcription text will not be written to disk."
            checked={prefs.dontSaveTranscripts}
            onChange={(v) => { setPref('dontSaveTranscripts', v); }}
          />
          <ToggleRow
            label="Don't save audio"
            description="Recorded audio will not be written to disk."
            checked={prefs.dontSaveAudio}
            onChange={(v) => { setPref('dontSaveAudio', v); }}
          />
        </section>

        {/* Language */}
        <section className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Primary language</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {languageEnabled
                  ? 'Language hint passed to the transcription model.'
                  : 'Not available — the active model is English-only.'}
              </p>
            </div>
            <select
              disabled={!languageEnabled}
              value={prefs.primaryLanguage}
              onChange={(e) => { setPref('primaryLanguage', e.target.value); }}
              className="w-40 px-3 py-1.5 text-sm rounded-md border border-input bg-background text-foreground
                         focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {LANGUAGES.map(({ code, label }) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>
        </section>
      </div>
    </div>
  );
}
