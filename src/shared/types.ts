// ─── Recording ───────────────────────────────────────────────────────────────

/** The three phases of a single voice-to-text session. */
export type RecordingState = 'idle' | 'recording' | 'processing'

/** How the global shortcut triggers recording. Only toggle is in scope for now. */
export type ShortcutMode = 'toggle'

/** The macOS application that was in focus when recording started. */
export interface CapturedApp {
  readonly bundleId: string
  readonly name: string
}

/** Outcome of a paste attempt into the target application. */
export type PasteResult =
  | { readonly success: true }
  | { readonly success: false; readonly reason: 'appGone' | 'accessibilityDenied' | 'selfTarget' }

// ─── Reusable local model module ─────────────────────────────────────────────

/** Minimum metadata any downloadable AI model must provide to LocalModelService. */
export interface ModelSpec {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly fileSizeBytes: number
}

/**
 * Abstraction over any AI runtime that can load a model and run inference.
 * Lets LocalModelService remain independent of Transformers.js or any other backend.
 */
export interface InferenceBackend<TInput, TOutput> {
  /** Load the given model from disk into the runtime. */
  load(modelId: string, storagePath: string): Promise<void>
  /** Run inference on one input and return the result. */
  run(input: TInput): Promise<TOutput>
  /** Release the currently loaded model from memory. */
  unload(): void
  readonly isLoaded: boolean
}

// ─── Models (moVoice-specific) ────────────────────────────────────────────────

/** Audio data and language hint passed to a Whisper inference call. */
export interface TranscriptionInput {
  readonly audio: Float32Array
  /** `null` asks the model to auto-detect the language from the audio. */
  readonly language: string | null
}

/** Whisper model metadata as stored in resources/models.json. */
export interface WhisperModelSpec extends ModelSpec {
  readonly huggingFaceRepo: string
  readonly speedScore: number      // 1.0–5.0
  readonly accuracyScore: number   // 1.0–5.0
  /** `false` for English-only variants such as whisper-tiny.en. */
  readonly isMultilingual: boolean
}

/** A downloadable Whisper model available in the catalog. */
export type ModelDefinition = WhisperModelSpec & { readonly isBuiltin: false }

/** The synthetic entry representing macOS on-device speech recognition. */
export interface BuiltinModelDefinition {
  readonly id: 'builtin'
  readonly label: 'Built-in macOS Recognition'
  readonly description: string
  readonly isMultilingual: true
  readonly isBuiltin: true
}

/** Any model that can be set as active — either a Whisper model or the built-in recogniser. */
export type AnyModelDefinition = ModelDefinition | BuiltinModelDefinition

/** Runtime state fields added to any model definition when building the UI model list. */
interface ModelEntryState {
  readonly isDownloaded: boolean
  readonly isActive: boolean
  /** `null` when no download is in progress for this model. */
  readonly downloadProgress: number | null
}

/** A model entry as presented to the UI, enriched with runtime state. */
export type ModelEntry = (ModelDefinition & ModelEntryState) | (BuiltinModelDefinition & ModelEntryState)

// ─── Transcription ───────────────────────────────────────────────────────────

/** Text produced by transcribing a recording, plus the language the model resolved. */
export interface TranscriptionResult {
  readonly text: string
  /** `null` for English-only models and for built-in recognition. */
  readonly detectedLanguage: string | null
}

// ─── Session History ─────────────────────────────────────────────────────────

/** Persistent record of one completed recording-and-transcription session. */
export interface SessionRecord {
  readonly id: string                    // UUID v4
  readonly timestamp: number            // Unix ms, recording start time
  readonly transcriptionText: string
  readonly audioPath: string | null
  readonly transcriptPath: string | null
  readonly modelId: string
  /** Language preference captured at recording start; `null` means auto-detect was selected. */
  readonly language: string | null
  /** Language actually detected or used by the model; `null` if not reported. */
  readonly detectedLanguage: string | null
  readonly audioDurationSeconds: number
  readonly transcriptionDurationMs: number
  readonly targetAppName: string
  readonly audioSaved: boolean
  readonly transcriptSaved: boolean
}

// ─── Statistics ───────────────────────────────────────────────────────────────

/** Aggregate productivity metrics shown on the Settings dashboard. */
export interface DashboardStats {
  readonly totalSessions: number
  readonly totalWords: number
  readonly totalTimeSavedSeconds: number
  readonly wordsPerMinute: number
  readonly keystrokesSaved: number
}

// ─── Preferences ─────────────────────────────────────────────────────────────

/** All user-configurable application settings. */
export interface Preferences {
  readonly shortcutKey: string
  readonly shortcutMode: ShortcutMode
  readonly hideDockIcon: boolean
  readonly launchAtLogin: boolean
  readonly dontSaveTranscripts: boolean
  readonly dontSaveAudio: boolean
  readonly activeModelId: string
  /**
   * BCP-47 language code (e.g. `"en"`, `"uk"`) or the sentinel `"auto"`.
   * Ignored entirely for single-language models.
   */
  readonly primaryLanguage: string
  /**
   * Absolute path to the directory where model files are stored.
   * Set to `<userData>/models` on first run; changing it does not move existing files.
   */
  readonly modelStoragePath: string
}

/** Values used when a preference key has never been written. */
export const PREFERENCE_DEFAULTS: Preferences = {
  shortcutKey: 'F5',
  shortcutMode: 'toggle',
  hideDockIcon: false,
  launchAtLogin: false,
  dontSaveTranscripts: false,
  dontSaveAudio: false,
  activeModelId: 'builtin',
  primaryLanguage: 'auto',
  modelStoragePath: '',
}

/** Union of all valid preference keys, used to enforce type-safe access. */
export type PreferenceKey = keyof Preferences

// ─── Permissions ─────────────────────────────────────────────────────────────

/** A macOS permission that the application requires. */
export type PermissionType = 'microphone' | 'speechRecognition' | 'accessibility'

/** Whether the user has granted a macOS permission. */
export type PermissionGrantStatus = 'granted' | 'denied' | 'notDetermined'

/** The current grant status for one macOS permission, as shown on the Permissions page. */
export interface PermissionStatus {
  readonly type: PermissionType
  readonly status: PermissionGrantStatus
  readonly description: string
}

// ─── App Info ────────────────────────────────────────────────────────────────

/** Static application metadata displayed on the About page. */
export interface AppInfo {
  readonly name: string
  readonly version: string
  readonly author: string
}

// ─── TranscriptionService ────────────────────────────────────────────────────

/** Converts raw audio into text. */
export interface TranscriptionService {
  /** Transcribe `audio` and return the resulting text. Pass `null` for `language` to auto-detect. */
  transcribe(audio: Float32Array, language: string | null): Promise<TranscriptionResult>
}
