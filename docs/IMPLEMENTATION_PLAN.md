# moVoice — Implementation Plan

> **Instructions for agents:** Work through steps in order. When a step is done, change `[ ]` to
> `[x]`. If the step is partially done or has caveats, change it to `[~]` and add a **Note:**
> directly below the step. Never skip an integration step — it is as important as the module step
> that precedes it. Do not mark a step complete until the code compiles with zero ESLint/TSC errors.

---

## How to read this plan

- Steps are numbered sequentially. Each one names the file(s) to create or modify.
- "Integration" steps appear immediately after the modules they connect. They are not optional.
- Module steps are atomic: one class / one file / one proto service at a time.
- After completing each phase, run `npm run lint` (or equivalent) to verify zero warnings.

---

## Phase 1 — Foundation

### 1.1 — Remove scaffolding code
- [x] Delete the demo IPC services from `src/main/index.ts` (`GreetService`, `AppService`).
- [x] Delete `src/renderer/proto/greet.proto` and `src/renderer/proto/app.proto`.
- [x] Delete `src/native/proto/greet.proto` and replace `src/native/main.cc` with an empty `launch()` stub.
- [x] Clear `src/renderer/App.tsx` down to a minimal placeholder `<div>moVoice</div>`.
- [~] Run `npm run gen` to regenerate (now empty) stubs and confirm zero compile errors.
  **Note:** `npm run gen` requires at least one native `.proto` file — an empty proto dir causes
  a CMake error. Gen was run successfully after Phase 2 proto files were in place (2.1–2.4).

### 1.2 — Shared type definitions
- [x] Create `src/shared/types.ts` with all interfaces, types, and constants from `arch_essay.md §Part VIII`:
  - `RecordingState`, `ShortcutMode`, `CapturedApp`, `PasteResult`
  - `ModelSpec`, `InferenceBackend<TInput, TOutput>`
  - `TranscriptionInput`, `WhisperModelSpec`, `ModelDefinition`, `BuiltinModelDefinition`, `AnyModelDefinition`, `ModelEntry`
  - `TranscriptionResult`
  - `SessionRecord`
  - `DashboardStats`
  - `Preferences`, `PREFERENCE_DEFAULTS`, `PreferenceKey`
  - `PermissionType`, `PermissionGrantStatus`, `PermissionStatus`
  - `AppInfo`

### 1.3 — Model catalog resource
- [x] Create `resources/models.json` with at least the following Whisper model entries
  (use `WhisperModelSpec` shape: `id`, `label`, `description`, `huggingFaceRepo`,
  `speedScore`, `accuracyScore`, `fileSizeBytes`, `isMultilingual`):
  - `openai/whisper-tiny` (multilingual)
  - `openai/whisper-tiny.en` (English-only)
  - `openai/whisper-base` (multilingual)
  - `openai/whisper-base.en` (English-only)
  - `openai/whisper-small` (multilingual)
  - `openai/whisper-small.en` (English-only)

---

## Phase 2 — Native Module

> All native services live in `src/native/`. Proto files for native services live in
> `src/native/proto/`. After every `.proto` addition run `npm run gen` to regenerate C++ and
> TypeScript stubs.

### 2.1 — `SystemPermissionsService` (native)
- [x] Create `src/native/proto/permissions.proto` with `SystemPermissionsService`:
  - `rpc GetPermissionsStatus(Empty) returns (PermissionsStatusResponse)`
  - `rpc OpenSystemSettings(PermissionTypeRequest) returns (Empty)`
  - Messages: `PermissionsStatusResponse` (repeated `PermissionStatusProto`),
    `PermissionStatusProto` (`string type`, `string status`),
    `PermissionTypeRequest` (`string type`)
- [x] Implement `SystemPermissionsServiceImpl` in `src/native/main.mm`:
  - `GetPermissionsStatus`: query `AVCaptureDevice.authorizationStatus(for: .audio)`,
    `AXIsProcessTrusted()`, `SFSpeechRecognizer.authorizationStatus` in one call.
  - `OpenSystemSettings`: open the correct `x-apple.systempreferences:` URL per `PermissionType`.
- [x] Add `AVFoundation`, `Speech`, and `ApplicationServices` framework links to `CMakeLists.txt`.
- [x] Run `npm run gen` and confirm the generated TypeScript bindings compile.
  **Note:** Source renamed from `main.cc` → `main.mm` (Objective-C++) and `CMakeLists.txt`
  updated with `LANGUAGES CXX OBJCXX`.

### 2.2 — `PasteService` (native)
- [x] Create `src/native/proto/paste.proto` with `PasteService`:
  - `rpc CaptureFrontmostApp(Empty) returns (CapturedAppResponse)`
  - `rpc ActivateAndPaste(ActivateRequest) returns (ActivateResult)`
  - Messages: `CapturedAppResponse` (`string bundle_id`, `string name`),
    `ActivateRequest` (`string bundle_id`),
    `ActivateResult` (`bool success`, `string error_code`)
- [x] Implement `PasteServiceImpl` in `src/native/main.mm`:
  - `CaptureFrontmostApp`: `NSWorkspace.shared.frontmostApplication` → bundle ID + name.
  - `ActivateAndPaste`: activate by bundle ID via `NSRunningApplication.activate()`, then
    synthesize Cmd+V via `CGEventCreateKeyboardEvent`. Return error if app not running.
- [x] Add `AppKit` and `CoreGraphics` framework links to `CMakeLists.txt`.
- [x] Run `npm run gen`.

### 2.3 — `LoginItemService` (native)
- [x] Create `src/native/proto/login_item.proto` with `LoginItemService`:
  - `rpc SetLaunchAtLogin(BoolRequest) returns (Empty)`
  - Message: `BoolRequest` (`bool value`)
- [x] Implement `LoginItemServiceImpl` using `SMAppService` (macOS 13+) in `src/native/main.mm`.
- [x] Add `ServiceManagement` framework link to `CMakeLists.txt`.
- [x] Run `npm run gen`.

### 2.4 — `BuiltinSpeechService` (native)
- [x] Create `src/native/proto/builtin_speech.proto` with `BuiltinSpeechService`:
  - `rpc RunBuiltinSpeechRecognition(SpeechRequest) returns (SpeechResponse)`
  - Messages: `SpeechRequest` (`bytes pcm`, `string language`),
    `SpeechResponse` (`string text`, `string detected_language`)
- [x] Implement `BuiltinSpeechServiceImpl`: submit `Float32Array` (16 kHz mono) to
  `SFSpeechRecognizer` using the provided `language` locale. Return transcribed text.
  **Note:** Uses a `dispatch_semaphore` with a 30-second timeout to bridge the async
  `SFSpeechRecognizer` completion handler into the synchronous RPC callback model.
- [x] Run `npm run gen`.

### 2.5 — Integration: wire all native services into `launch()`
- [x] In `src/native/main.mm` register all four service implementations in `launch()`:
  ```cpp
  void launch() {
    mo::rpc::RegisterService(new SystemPermissionsServiceImpl());
    mo::rpc::RegisterService(new PasteServiceImpl());
    mo::rpc::RegisterService(new LoginItemServiceImpl());
    mo::rpc::RegisterService(new BuiltinSpeechServiceImpl());
  }
  ```
- [x] Build the native module (`npm run build`) and confirm it compiles.

---

## Phase 3 — Main Process Core Services

> All main-process services live under `src/main/services/`. Each file exports one class.

### 3.1 — `PreferencesService`
- [x] Create `src/main/services/PreferencesService.ts`.
- [x] Implement write-through wrapper over MōBrowser `prefs`:
  - `get<T>(key: PreferenceKey): T` — reads the typed value, returns `PREFERENCE_DEFAULTS[key]` if absent.
  - `set<T>(key: PreferenceKey, value: T): void` — writes and immediately calls `prefs.persist()`.
  - `getAll(): Preferences` — returns a full snapshot.
- [x] Import `Preferences`, `PreferenceKey`, `PREFERENCE_DEFAULTS` from `src/shared/types.ts`.

### 3.2 — `StatsCalculator`
- [x] Create `src/main/services/StatsCalculator.ts`.
- [x] Implement `compute(sessions: SessionRecord[]): DashboardStats` as a pure method:
  - `totalSessions`: `sessions.length`
  - `totalWords`: sum of `transcriptionText.split(/\s+/).filter(Boolean).length` per session
  - `totalTimeSavedSeconds`: `totalWords / BASELINE_TYPING_WPM * 60`
  - `wordsPerMinute`: `totalWords / (totalAudioDurationSeconds / 60)` — guard for zero audio
  - `keystrokesSaved`: `totalWords * AVG_WORD_LENGTH_WITH_SPACE`
  - Export constants `BASELINE_TYPING_WPM = 40` and `AVG_WORD_LENGTH_WITH_SPACE = 6`.

### 3.3 — `SessionFileManager`
- [x] Create `src/main/services/SessionFileManager.ts`.
- [x] Constructor receives `userDataPath: string` (the base `<userData>/sessions/` parent).
- [x] Implement:
  - `getSessionDir(sessionId: string): string`
  - `getAudioPath(sessionId: string): string`
  - `getTranscriptPath(sessionId: string): string`
  - `saveAudio(sessionId: string, pcm: Float32Array): Promise<void>` — write 44-byte WAV header
    (RIFF/WAVE/fmt/data, 16 kHz, mono, 32-bit float PCM) then raw `Float32Array` bytes.
  - `saveTranscript(sessionId: string, text: string): Promise<void>` — plain text.
  - `deleteSessionFiles(sessionId: string): Promise<void>` — remove the session directory.
  - `fileExists(path: string): boolean`
  - `getAudioFileUrl(sessionId: string): string` — return `file://` URL, empty string if not saved.

### 3.4 — `HistoryStore`
- [x] Create `src/main/services/HistoryStore.ts`.
- [x] Constructor receives `userDataPath: string` and `sessionFileManager: SessionFileManager`.
- [x] On `initialize()`: load `<userDataPath>/history.json`; create file if absent.
- [x] Implement:
  - `addSession(record: SessionRecord): void` — append to in-memory array, write JSON synchronously.
  - `getSessions(): SessionRecord[]` — return a frozen copy.
  - `getSession(id: string): SessionRecord | undefined`
  - `deleteSession(id: string): Promise<void>` — calls `sessionFileManager.deleteSessionFiles()`,
    then removes from array, then writes JSON.
  - `revealAudioFile(id: string): void` — calls `desktop.showPath()` via `SessionFileManager`.
  - `revealTranscriptFile(id: string): void` — same.

### 3.5 — `WhisperModelCatalog`
- [x] Create `src/main/services/WhisperModelCatalog.ts`.
- [x] Constructor receives `resourcesPath: string` (from `app.getPath('appResources')`).
- [x] `getAll(): WhisperModelSpec[]` — reads and parses `resources/models.json` once (lazy-load,
  cached after first call).
- [x] `getById(id: string): WhisperModelSpec | undefined`.

---

## Phase 4 — Transcription Infrastructure

### 4.1 — `TransformersJsWorker` (worker thread)
- [x] Create `src/main/workers/TransformersJsWorker.ts` — the **worker thread script** (runs inside
  `worker_threads.Worker`). It must not import any MōBrowser API.
- [x] On `loadModel` message: use `transformers` pipeline (Transformers.js v4) to load the ASR
  pipeline for the given `modelId` with `localFilesOnly: true` and `cacheDir: storagePath`.
- [x] On `run` message: call the loaded pipeline with `{ audio, language }`, post back result.
- [x] Error handling: post `{ type: 'error', message }` on any thrown exception.

### 4.2 — `TransformersJsBackend`
- [x] Create `src/main/services/TransformersJsBackend.ts`.
- [x] Implements `InferenceBackend<TranscriptionInput, TranscriptionResult>`.
- [x] Constructor: spawns `TransformersJsWorker` via `worker_threads.Worker`.
- [x] `load(modelId, storagePath)`: send `{ type: 'loadModel', modelId, storagePath }`, await
  `modelLoaded` or `error`.
- [x] `run(input)`: send `{ type: 'run', input }`, await `result` or `error`. Serialize `Float32Array`
  as `ArrayBuffer` in the `transferList`.
- [x] `unload()`: terminate the worker.
- [x] Internal serialization: `load()` and `run()` share a sequential promise queue so that a
  `loadModel` request during an active inference is queued, not lost (§2.13).
- [x] `isLoaded: boolean` property.

### 4.3 — `LocalModelService`
- [x] Create `src/main/services/LocalModelService.ts` as a generic class
  `LocalModelService<TSpec extends ModelSpec, TInput, TOutput>`.
- [x] Constructor receives: `catalog: TSpec[]`, `backend: InferenceBackend<TInput, TOutput>`,
  `storagePath: string`, `onStoragePathChanged: (path: string) => void`.
- [x] Implement all methods from `arch_essay.md §4.6`:
  - `initialize(storagePath: string)`: scan `storagePath` against catalog to set `isDownloaded`;
    enforce active-model invariant (if stored `activeModelId` refers to deleted model, fall back).
  - `warmUp()`: call `backend.load(activeModelId, storagePath)` if an active model exists.
  - `getModels(): Array<TSpec & { isDownloaded: boolean; isActive: boolean; downloadProgress: number | null }>`
  - `getActiveModel()`: returns entry or null.
  - `setActiveModel(modelId: string)`: calls `backend.load()`, fires `onActiveModelChanged` callbacks.
  - `downloadModel(modelId, onProgress)`: download files via `https` to `storagePath`; store
    in-progress fraction; clean up on failure.
  - `cancelDownload(modelId)`: abort in-flight download.
  - `deleteModel(modelId)`: calls `backend.unload()` if active, removes files, enforces invariant.
  - `getStoragePath(): string`
  - `updateStoragePath(path)`: refuse if download in progress; re-scan; enforce invariant.
  - `run(input)`: delegates to `backend.run(input)`.
  - `revealInFinder(modelId)`: calls `desktop.showPath(modelFilePath)`.
  - `onActiveModelChanged(callback)`: register listener.

### 4.4 — `BuiltinSpeechTranscriptionService`
- [x] Create `src/main/services/BuiltinSpeechTranscriptionService.ts`.
- [x] Implements `TranscriptionService` (from `src/shared/types.ts`).
- [x] Constructor receives `native` bindings (generated `src/main/gen/native.ts`).
- [x] `transcribe(audio, language)`: calls `native.speech.RunBuiltinSpeechRecognition({ pcm, language })`.
  Returns `TranscriptionResult`.

### 4.5 — `TranscriptionRouter`
- [x] Create `src/main/services/TranscriptionRouter.ts`.
- [x] Implements `TranscriptionService`.
- [x] Constructor receives `localModelService: LocalModelService<...>`,
  `builtinService: BuiltinSpeechTranscriptionService`,
  `preferences: PreferencesService`.
- [x] `transcribe(audio, language)`: reads `preferences.get('activeModelId')`;
  if `'builtin'` → delegates to `builtinService`; otherwise → delegates to `localModelService.run()`.

### 4.6 — Integration: verify transcription pipeline in isolation
- [x] Write a temporary test script `temp/test-transcription.ts` (not a test framework — just a
  runnable Node.js script). It should:
  1. Instantiate `TransformersJsBackend`.
  2. Call `load('openai/whisper-tiny', '<some local path>')` — skip if no model is downloaded yet
     (just verify the constructor and message protocol don't throw).
  3. Log `backend.isLoaded`.
  4. Terminate.
- [x] After verifying, delete `temp/test-transcription.ts`. Do not ship test scripts.

---

## Phase 5 — Recording Domain

### 5.1 — `RecordingSession` value object
- [x] Create `src/main/domain/RecordingSession.ts`.
- [x] Export a plain `interface RecordingSession` (import the `CapturedApp` from shared types):
  ```ts
  interface RecordingSession {
    readonly id: string
    readonly startedAt: number
    readonly capturedApp: CapturedApp
    readonly language: string | null
    readonly dontSaveAudio: boolean
    readonly dontSaveTranscripts: boolean
  }
  ```
- [x] Export `createRecordingSession(params: Omit<RecordingSession, 'id' | 'startedAt'>): RecordingSession`
  — generates a UUID v4 via `crypto.randomUUID()`.

### 5.2 — `RecordingSessionController`
- [x] Create `src/main/domain/RecordingSessionController.ts`.
- [x] Constructor receives:
  - `transcriptionService: TranscriptionService`
  - `pasteCoordinator: PasteCoordinator` (forward declaration — import after Phase 6)
  - `historyStore: HistoryStore`
  - `sessionFileManager: SessionFileManager`
  - `preferences: PreferencesService`
  - `native` bindings (for `CaptureFrontmostApp`)
- [x] Internal FSM state: `'idle' | 'recording' | 'processing'`. No external FSM library.
- [x] Implement all transitions from `arch_essay.md §2.2`:
  - `start()`: check mic permission via native; capture frontmost app; create `RecordingSession`;
    transition to `'recording'`; fire state-change callbacks.
  - `stop()`: transition to `'processing'`; fire callbacks. Audio is delivered later by `submitAudio`.
  - `cancel()`: if `'recording'` or `'processing'`, transition to `'idle'`; no history entry. Fire callbacks.
  - `submitAudio(pcm: Float32Array)`: called by the IPC layer when the renderer sends audio.
    Runs: `transcriptionService.transcribe(pcm, session.language)` → `pasteCoordinator.paste()` →
    `historyStore.addSession()` (if not cancelled mid-flight) → transition `'idle'`. Fire callbacks.
  - `getState(): RecordingState`
  - `onStateChange(callback: (state: RecordingState) => void): void`

### 5.3 — Integration: wire `RecordingSessionController` dependencies (placeholder)
- [x] At the top of `src/main/index.ts`, add a TODO comment block listing all the injected
  dependencies that `RecordingSessionController` needs. These will be resolved in Phase 8 when the
  composition root is built. This step just ensures the imports compile.

---

## Phase 6 — OS Integration

### 6.1 — `ShortcutManager`
- [x] Create `src/main/services/ShortcutManager.ts`.
- [x] Constructor receives `controller: RecordingSessionController`.
- [x] `register(shortcut: string): void` — calls `globalShortcut.register()`. On fire:
  if `controller.getState() === 'idle'` → `controller.start()`; else if `'recording'` →
  `controller.stop()`. No-op if `'processing'`.
- [x] `unregister(): void` — calls `globalShortcut.unregister()`.
- [x] `update(shortcut: string): void` — unregisters the old, registers the new.

### 6.2 — `PasteCoordinator`
- [x] Create `src/main/services/PasteCoordinator.ts`.
- [x] Constructor receives `native` bindings, `clipboard` from `@mobrowser/api`, `ownBundleId: string`.
- [x] `paste(text: string, target: CapturedApp): Promise<PasteResult>`:
  1. Write `text` to `clipboard` with type `'text/plain'`.
  2. If `target.bundleId === ownBundleId` → return `{ success: false, reason: 'selfTarget' }`.
  3. Check accessibility permission via `native.permissions.GetPermissionsStatus()`.
     If denied → return `{ success: false, reason: 'accessibilityDenied' }`.
  4. Call `native.paste.ActivateAndPaste({ bundleId: target.bundleId })`.
     On error → return `{ success: false, reason: 'appGone' }`.
  5. Return `{ success: true }`.

### 6.3 — `TrayController`
- [x] Create `src/main/controllers/TrayController.ts`.
- [x] Constructor receives `preferences: PreferencesService`,
  `localModelService: LocalModelService<...>`, `windowManager: WindowManager`,
  `controller: RecordingSessionController`.
  **Note:** `native` bindings also added to support the "Launch at Login" toggle via `LoginItemService`.
- [x] `initialize()`: create `Tray` instance, call `refresh()`, listen on `mouseDown` to call
  `tray.openMenu()`.
- [x] `refresh()`: rebuild the full `Menu` from current state and call `tray.setMenu()`.
  Menu items:
  - "Start Recording" (disabled when `state !== 'idle'`)
  - Submenu "Select Model" — one `CheckboxMenuItem` per downloaded model + builtin; checked = active
  - Submenu "Primary Language" — disabled when active model is not multilingual
  - Separator
  - "Settings…" → `windowManager.showSettings()`
  - "History…" → `windowManager.showHistory()`
  - "About" → `windowManager.showAbout()`
  - Separator
  - `CheckboxMenuItem` "Hide Dock Icon" (checked = `preferences.get('hideDockIcon')`)
  - `CheckboxMenuItem` "Launch at Login" (checked = `preferences.get('launchAtLogin')`)
  - Separator
  - "Quit" → `app.quit()`
  **Note:** `MenuOptions` has no `enabled` property; a disabled `MenuItem` placeholder is rendered
  in place of the language submenu when the active model is not multilingual.

### 6.4 — `WindowManager`
- [x] Create `src/main/controllers/WindowManager.ts`.
- [x] Constructor receives `appUrl: string`.
- [x] Each window is a `BrowserWindow` with a URL hash to distinguish them:
  - Recording: `appUrl + '#recording'`
  - Settings: `appUrl + '#settings'`
  - History: `appUrl + '#history'`
  - About: `appUrl + '#about'`
- [x] Recording window: created eagerly in constructor, hidden. No titlebar. Positioned at bottom
  center above Dock: compute `x = (screenWidth - windowWidth) / 2`, `y = screenHeight - dockHeight - windowHeight - margin`. Use `win.setAlwaysOnTop(true)`.
  **Note:** No MōBrowser screen API exists; screen dimensions are derived by briefly calling
  `centerWindow()` and reading the resulting `position` (back-computing screenW/H from center).
- [x] Settings, History: created lazily on first show; hidden on close (not destroyed). If already
  open, call `win.show()` (`activate()` not present in MōBrowser typings; `show()` brings to front).
- [x] About: destroyed on close, recreated on each show.
- [x] Implement:
  - `showRecordingWindow()`
  - `transitionRecordingWindowToProcessing()` — no-op; renderer detects state via polling
  - `hideRecordingWindow()`
  - `showSettings(page?: string)`
  - `showHistory()`
  - `showAbout()`

Notes: 
Key discoveries:                                                                                                                                                                                               
  - No screen API in MōBrowser — derives screen dimensions by calling centerWindow() and back-computing from the resulting position offset                                                                                                      
  - activate() doesn't exist in the MōBrowser typings — show() serves the same purpose (brings to front when already visible)                                                                                                                   
  - Settings/History windows are hidden on close via browser.handle('close', async () => { win.hide(); return 'cancel'; }) 

### 6.5 — Integration: connect `RecordingSessionController` ↔ `WindowManager` ↔ `TrayController`
- [x] In `WindowManager`, expose `onRecordingWindowClosed(callback)` so the composition root can
  wire a cancel call. (Window close without explicit cancel → treat as cancel.)
- [x] Ensure `RecordingSessionController.onStateChange()` callback will drive:
  - `idle → recording`: `windowManager.showRecordingWindow()`
  - `recording → processing`: `windowManager.transitionRecordingWindowToProcessing()`
  - `* → idle`: `windowManager.hideRecordingWindow()`
  - Any state change: `trayController.refresh()`
- [x] These wiring lines go in the composition root (Phase 8), but confirm the method signatures
  here resolve without TypeScript errors.

---

## Phase 7 — IPC Contract

> Proto files live in `src/renderer/proto/`. Run `npm run gen` after every `.proto` change.

### 7.1 — Shared `error.proto`
- [x] Create `src/renderer/proto/error.proto`:
  ```protobuf
  syntax = "proto3";
  message Error {
    string code = 1;
    string message = 2;
  }
  ```
  **Note:** Also added `StringResponse` here (shared by model.proto and history.proto) to avoid
  duplicate symbol conflicts when all renderer protos share a namespace.

### 7.2 — `recording.proto`
- [x] Create `src/renderer/proto/recording.proto` per `arch_essay.md §Part VII`.
  - `RecordingService` with `GetStatus`, `CancelRecording`, `SubmitAudio`.
  - `RecordingStatusResponse`, `SubmitAudioRequest`, `RecordingState` enum.

### 7.3 — `settings.proto`
- [x] Create `src/renderer/proto/settings.proto`:
  - `SettingsService` with `GetPreferences`, `SetPreference`.
  - Include full `PreferencesProto` message mirroring all `Preferences` fields as strings/bools/numbers.

### 7.4 — `model.proto`
- [x] Create `src/renderer/proto/model.proto`:
  - `ModelService` with `GetModels`, `DownloadModel`, `CancelDownload`, `DeleteModel`,
    `SetActiveModel`, `GetDownloadProgress`, `PickStoragePath`, `SetStoragePath`,
    `RevealInFinder`.
  - `ModelEntryProto` message with all `ModelEntry` fields.
  - `ModelListResponse`, `DownloadProgressResponse`, `StringResponse`, `PathRequest`.
  **Note:** `RevealInFinder` was omitted from the initial implementation and patched in
  during Phase 11 when `ModelCard` required it.

### 7.5 — `history.proto`
- [x] Create `src/renderer/proto/history.proto`:
  - `HistoryService` with `GetSessions`, `DeleteSession`, `RevealAudioFile`,
    `RevealTranscriptFile`, `GetAudioUrl`.
  - `SessionRecordProto` message mirroring all `SessionRecord` fields.
  - `SessionListResponse`, `SessionIdRequest`.

### 7.6 — `permissions.proto`
- [x] Create `src/renderer/proto/permissions.proto`:
  - `PermissionsService` with `GetPermissions`, `OpenSystemSettings`, `RefreshPermissions`.
  - `PermissionStatusProto` (`string type`, `string status`, `string description`).
  - `PermissionsResponse` (repeated `PermissionStatusProto`).
  - `PermissionTypeRequest`.
  - `PermissionType` enum: `MICROPHONE`, `SPEECH_RECOGNITION`, `ACCESSIBILITY`.

### 7.7 — `stats.proto`
- [x] Create `src/renderer/proto/stats.proto`:
  - `StatsService` with `GetStats`.
  - `DashboardStatsResponse` mirroring `DashboardStats`.

### 7.8 — `app_info.proto`
- [x] Create `src/renderer/proto/app_info.proto`:
  - `AppInfoService` with `GetAppInfo`.
  - `AppInfoResponse` (`string name`, `string version`, `string author`).

### 7.9 — Code generation
- [x] Run `npm run gen` and confirm all generated stubs in `src/main/gen/` and `src/renderer/gen/`
  compile without errors.

### 7.10 — `RecordingIpcService` (main process)
- [x] Create `src/main/ipc/RecordingIpcService.ts`.
- [x] Constructor receives `controller: RecordingSessionController`.
- [x] Implement generated `RecordingService` interface:
  - `GetStatus({})`: returns `{ state: controller.getState() }`.
  - `CancelRecording({})`: calls `controller.cancel()`, returns `{}`.
  - `SubmitAudio({ pcm })`: deserialize bytes to `Float32Array`, calls
    `controller.submitAudio(pcmArray)`, returns `{}`.

### 7.11 — `SettingsIpcService` (main process)
- [x] Create `src/main/ipc/SettingsIpcService.ts`.
- [x] Constructor receives `preferences: PreferencesService`,
  `shortcutManager: ShortcutManager`, `native` bindings.
- [x] `GetPreferences({})`: returns `preferences.getAll()` mapped to proto message.
- [x] `SetPreference({ key, value })`: validates `key` against `PreferenceKey` union type;
  parses and sets value; if `key === 'shortcutKey'` → calls `shortcutManager.update(value)`;
  if `key === 'launchAtLogin'` → calls `native.loginItem.SetLaunchAtLogin({ value: parsed })`;
  returns `{}`.

### 7.12 — `ModelIpcService` (main process)
- [x] Create `src/main/ipc/ModelIpcService.ts`.
- [x] Constructor receives `localModelService: LocalModelService<WhisperModelSpec, ...>`,
  `preferences: PreferencesService`.
- [x] Map `LocalModelService` state to proto `ModelEntryProto` list. Include the synthetic
  `builtin` entry (not from the catalog) with `id: 'builtin'`, `label: 'Built-in macOS Recognition'`,
  `isDownloaded: true`, `isActive: preferences.get('activeModelId') === 'builtin'`.
- [x] `PickStoragePath({})`: calls `app.showOpenDialog()` with `selectionPolicy: 'directories'`;
  returns chosen path or `''`.
- [x] All other methods delegate directly to `LocalModelService`.
  **Note:** `RevealInFinder` was added as a patch during Phase 11.

### 7.13 — `HistoryIpcService` (main process)
- [x] Create `src/main/ipc/HistoryIpcService.ts`.
- [x] Constructor receives `historyStore: HistoryStore`, `sessionFileManager: SessionFileManager`.
- [x] Map `SessionRecord[]` to proto messages. `GetAudioUrl` → `sessionFileManager.getAudioFileUrl()`.

### 7.14 — `PermissionsIpcService` (main process)
- [x] Create `src/main/ipc/PermissionsIpcService.ts`.
- [x] Constructor receives `native` bindings.
- [x] `GetPermissions` and `RefreshPermissions`: call `native.permissions.GetPermissionsStatus()`,
  map to proto. Include human-readable `description` for each permission type.
- [x] `OpenSystemSettings`: call `native.permissions.OpenSystemSettings({ type })`.

### 7.15 — `StatsIpcService` (main process)
- [x] Create `src/main/ipc/StatsIpcService.ts`.
- [x] Constructor receives `historyStore: HistoryStore`, `statsCalculator: StatsCalculator`.
- [x] `GetStats({})`: `statsCalculator.compute(historyStore.getSessions())` → proto response.

### 7.16 — `AppInfoIpcService` (main process)
- [x] Create `src/main/ipc/AppInfoIpcService.ts`.
- [x] `GetAppInfo({})`: returns `{ name: app.name, version: app.version, author: app.copyright }`.

---

## Phase 8 — Application Composition Root

### 8.1 — `Application` class
- [x] Create `src/main/Application.ts`.
- [x] Constructor: retained only `shortcutManager` field for `shutdown()`. All other services
  are instantiated inside `initialize()` in strict dependency order.
- [x] `initialize(): Promise<void>` — runs the startup sequence from `arch_essay.md §2.7`:
  1. Seed `modelStoragePath` if empty (no explicit `load()` — PreferencesService reads lazily)
  2. Seed `modelStoragePath` if empty
  3. `trayController.initialize()`
  4. `dock.hide()` if `hideDockIcon` preference set
  5. `localModelService.initialize(preferences.get('activeModelId'))`
  6. `shortcutManager.register(preferences.get('shortcutKey'))`
  7. `localModelService.warmUp()` (non-fatal — logs error, does not propagate)
  8. First-run check: if `app.launchInfo.isFirstRun`, `windowManager.showSettings('permissions')`
- [x] Wire `RecordingSessionController.onStateChange()` → `windowManager` show/hide/transition
  and `trayController.refresh()`.
- [x] Wire `LocalModelService.onActiveModelChanged()` → `preferences.set('activeModelId', ...)` and
  `trayController.refresh()`.
- [x] Register all IPC services via `ipc.registerService(...)`.
- [x] `shutdown(): void` — `shortcutManager.unregister()`.
  **Note:** Fixed a type-assignability error in `TranscriptionRouter` — it was typed to
  `LocalModelService<ModelSpec, ...>` but received `LocalModelService<WhisperModelSpec, ...>`;
  the contravariant `ModelChangeCallback` private field broke the assignment. Replaced the
  concrete type with a minimal structural interface `LocalInferenceRunner { run(...) }`.

### 8.2 — Update `src/main/index.ts`
- [x] Replace existing content with Application bootstrap:
  imports `Application`, calls `initialize()`, shows a native message dialog and quits on fatal error.

---

## Phase 9 — Renderer: Multi-Window Router

> The renderer is one Vite build serving all four windows. The window identity is determined by
> `window.location.hash`.

### 9.1 — Top-level router
- [x] Update `src/renderer/App.tsx` to read `window.location.hash` and render the appropriate
  window component:
  - `#recording` → `<RecordingApp />`
  - `#settings` → `<SettingsApp />`
  - `#history` → `<HistoryApp />`
  - `#about` → `<AboutApp />`
  - Default (no hash or `#`) → render nothing (invisible; main window is never shown).
- [x] Wrap with `ThemeProvider`.

---

## Phase 10 — Renderer: Recording Window

### 10.1 — AudioWorklet script
- [x] Create `src/renderer/public/audio-processor.js` — an `AudioWorkletProcessor` named
  `"pcm-accumulator"`. On each `process()` call, post the `Float32Array` chunks via
  `this.port.postMessage`.

### 10.2 — `RecordingApp` component
- [x] Create `src/renderer/components/recording/RecordingApp.tsx`.
- [x] State: `recordingState: RecordingState`, `amplitude: number` (0–1).
- [x] **State polling loop** (`useEffect` with `setInterval` at 33 ms / ~30 fps):
  - Calls `ipc.recording.GetStatus({})`.
  - On `idle → recording` transition: call `startAudio()` — `getUserMedia({ audio: true })`,
    create `AudioContext`, add `AudioWorkletNode` ('pcm-accumulator') to accumulate PCM chunks,
    add `AnalyserNode` for amplitude.
  - On `recording → processing` transition: call `stopAudioAndSubmit()` — stop tracks, resample
    accumulated `Float32Array` to 16 kHz mono via `OfflineAudioContext`,
    call `ipc.recording.SubmitAudio({ pcm: resampledBuffer })`.
  - On `* → idle`: stop audio track, discard chunks.
- [x] Renders `<WaveformVisualizer amplitude={amplitude} />` when recording;
  `<ProcessingIndicator />` when processing; `<CancelButton />` always visible.

### 10.3 — `WaveformVisualizer` component
- [x] Create `src/renderer/components/recording/WaveformVisualizer.tsx`.
- [x] Receives `amplitude: number` prop (0–1).
- [x] Renders an animated bar or wave using CSS animation driven by `amplitude`.
  No canvas required — pure CSS/SVG acceptable.

### 10.4 — `ProcessingIndicator` component
- [x] Create `src/renderer/components/recording/ProcessingIndicator.tsx`.
- [x] Simple spinner or animated indicator. No IPC, no props needed.

### 10.5 — `CancelButton` component
- [x] Create `src/renderer/components/recording/CancelButton.tsx`.
- [x] `onCancel: () => void` prop.
- [x] On click: calls `ipc.recording.CancelRecording({})`, then invokes `onCancel` callback.

### 10.6 — Integration: recording window layout and positioning
- [x] Confirm `WindowManager` sets recording window to `alwaysOnTop: true` and correct
  bottom-center position. Verify the window size suits the three components above.
- [x] Confirm the `#recording` hash route in the router displays `RecordingApp`.

---

## Phase 11 — Renderer: Settings Window

### 11.1 — `SettingsApp` component (shell + navigation)
- [x] Create `src/renderer/components/settings/SettingsApp.tsx`.
- [x] Fetch all data on mount: `GetPreferences`, `GetModels`, `GetPermissions`, `GetStats`.
- [x] Render a sidebar nav with four pages: Dashboard, General, Models, Permissions.
- [x] Pass data slices as props to each page; pass refetch callbacks for mutations.

### 11.2 — `DashboardPage` component
- [x] Create `src/renderer/components/settings/DashboardPage.tsx`.
- [x] Receives `stats: DashboardStats` prop.
- [x] Renders five large stat banners (time saved, sessions, words dictated, WPM, keystrokes saved)
  with color and icon per banner.

### 11.3 — `GeneralPage` component
- [x] Create `src/renderer/components/settings/GeneralPage.tsx`.
- [x] Receives `preferences: Preferences`, `activeModel: ModelEntry | null`, `onChanged: () => void`.
- [x] Renders:
  - `<ShortcutConfigurator />` for global shortcut.
  - Toggle for "Hide Dock Icon".
  - Toggle for "Launch at Login".
  - Toggle for "Don't save transcripts".
  - Toggle for "Don't save audio".
  - Language dropdown (disabled if `!activeModel?.isMultilingual`).
- [x] Each change calls `ipc.settings.SetPreference({ key, value })` then `onChanged()`.

### 11.4 — `ShortcutConfigurator` component
- [x] Create `src/renderer/components/settings/ShortcutConfigurator.tsx`.
- [x] Props: `currentShortcut: string`, `onChange: (shortcut: string) => void`.
- [x] Show predefined common shortcuts as buttons; also a custom capture field that records
  the next keypress when focused and emits it via `onChange`.

### 11.5 — `ModelsPage` component
- [x] Create `src/renderer/components/settings/ModelsPage.tsx`.
- [x] Receives `models: ModelEntry[]`, `storagePath: string`, `onChanged: () => void`.
- [x] Renders a `<ModelCard />` for each model.
- [x] Polls `ipc.model.GetModels()` at 2 fps while any `downloadProgress >= 0`;
  clears interval when all downloads complete.
  **Note:** Polls `GetModels()` (rather than per-model `GetDownloadProgress()`) for simplicity,
  which achieves the same result with one call.
- [x] "Change…" button calls `ipc.model.PickStoragePath()`, then `ipc.model.SetStoragePath()` if
  non-empty, then `onChanged()`.

### 11.6 — `ModelCard` component
- [x] Create `src/renderer/components/settings/ModelCard.tsx`.
- [x] Props: `model: ModelEntry`, action callbacks.
- [x] Renders: label, description, speed/accuracy bars + numeric values, download progress bar
  if `downloadProgress >= 0`, "Download" / "Delete" / "Reveal in Finder" buttons,
  "In Use" badge if `isActive`.

### 11.7 — `PermissionsPage` component
- [x] Create `src/renderer/components/settings/PermissionsPage.tsx`.
- [x] Receives `permissions: PermissionStatus[]`.
- [x] Renders a `<PermissionRow />` per permission. "Refresh" button calls
  `ipc.permissions.RefreshPermissions()` and updates state.

### 11.8 — `PermissionRow` component
- [x] Create `src/renderer/components/settings/PermissionRow.tsx`.
- [x] Props: `permission: PermissionStatus`, `onOpenSettings: () => void`.
- [x] Icon, description, colour-coded status indicator, "Open in System Settings" button
  (visible only when `status !== 'granted'`).

---

## Phase 12 — Renderer: History Window

### 12.1 — `HistoryApp` component
- [x] Create `src/renderer/components/history/HistoryApp.tsx`.
- [x] Fetch `GetSessions()` on mount. Store `sessions` and `selectedId`.
- [x] Render `<SessionList />` on the left; `<SessionDetail />` on the right when `selectedId` set.

### 12.2 — `SessionList` component
- [x] Create `src/renderer/components/history/SessionList.tsx`.
- [x] Props: `sessions: SessionRecord[]`, `selectedId: string | null`, `onSelect: (id) => void`.
- [x] Renders one `<SessionItem />` per session, newest first.

### 12.3 — `SessionItem` component
- [x] Create `src/renderer/components/history/SessionItem.tsx`.
- [x] Props: `session: SessionRecord`, `isSelected: boolean`, `onSelect: () => void`.
- [x] Shows date/time, app name, short excerpt of transcript text.

### 12.4 — `SessionDetail` component
- [x] Create `src/renderer/components/history/SessionDetail.tsx`.
- [x] Props: `session: SessionRecord`, action callbacks.
- [x] Renders: full transcript text, `<AudioPlayer />`, metadata (model, durations, app, date),
  "Reveal audio", "Reveal transcript", "Delete" buttons.
- [x] "Delete" calls `ipc.history.DeleteSession()` then parent refetches.

### 12.5 — `AudioPlayer` component
- [x] Create `src/renderer/components/history/AudioPlayer.tsx`.
- [x] Props: `sessionId: string`, `disabled: boolean`.
- [x] Fetches audio URL via `ipc.history.GetAudioUrl()` on mount when not disabled.
- [x] Wraps `<audio controls src={url}>`. When `disabled`, renders the element visually
  grayed out with a "no audio saved" label overlay.
  **Note:** Props use `sessionId` (needed for the IPC call) rather than `audioPath` as
  written in the plan — `audioPath` alone is not sufficient to call `GetAudioUrl`.

---

## Phase 13 — Renderer: About Window

### 13.1 — `AboutApp` component
- [x] Create `src/renderer/components/about/AboutApp.tsx`.
- [x] Fetch `ipc.appInfo.GetAppInfo()` on mount.
- [x] Render: moVoice logo, app name, version, author, "Powered by MōBrowser" attribution.

---

## Phase 14 — End-to-End Integration

### 14.1 — First-run and permissions gate
- [ ] Verify that when `app.launchInfo.isFirstRun === true`, `windowManager.showSettings('permissions')`
  opens the Settings window and `SettingsApp` navigates to `PermissionsPage` automatically.
  (Pass the initial page as a hash sub-parameter, e.g., `#settings?page=permissions`.)

### 14.2 — Full recording flow smoke test
- [ ] Manually verify the complete happy path:
  1. App starts → tray icon appears, no windows visible.
  2. Press global shortcut → recording window appears at bottom center.
  3. Waveform animates while speaking.
  4. Press shortcut again → spinner shows.
  5. After transcription: text is pasted into the previously focused app.
  6. Recording window disappears.
  7. History window shows the session.
- [ ] Note any broken steps here as sub-items.

### 14.3 — Cancel flow
- [ ] Manually verify: start recording → click cancel button → window disappears immediately →
  no history entry added.

### 14.4 — Model download flow
- [ ] Manually verify: open Settings → Models page → click "Download" on a model →
  progress bar updates at ~2 fps → after completion model shows "In Use" if it became active.

### 14.5 — Preferences persistence
- [ ] Manually verify: change shortcut key → quit → relaunch → shortcut is retained.
  Change language → relaunch → language is retained.

### 14.6 — Dock hide / login item
- [ ] Toggle "Hide Dock Icon" → Dock icon disappears / reappears.
- [ ] Toggle "Launch at Login" → verify SMAppService registration (check System Settings →
  General → Login Items).

### 14.7 — Error paths
- [~] With mic permission revoked: press shortcut → verify notification shown, FSM stays `Idle`.
- [~] With accessibility permission revoked: text written to clipboard but not pasted; verify user
  is notified via `PasteResult.reason === 'accessibilityDenied'`.
  **Note:** Both notification paths were unimplemented (silent failures). Fixed by introducing
  `Notifier` interface in `RecordingSessionController`, `NotificationService` implementation,
  and injecting it via `Application.ts`. Manual smoke-test still required.

---

## Phase 15 — Polish and CI Readiness

### 15.1 — ESLint zero-warnings pass
- [ ] Run `npm run lint` (ESLint with `--max-warnings 0`). Fix all warnings.
- [ ] No `eslint-disable` suppressions without the mandatory comment block per CLAUDE.md lint policy.

### 15.2 — TypeScript strict mode pass
- [ ] Run `tsc --noEmit` in strict mode. Resolve all type errors and implicit `any` occurrences.

### 15.3 — Stylelint pass (if CSS files present)
- [ ] Run Stylelint on all `.css` files. Fix all warnings.

### 15.4 — clang-tidy pass (native module)
- [ ] Run clang-tidy on `src/native/*.cc`. Resolve warnings under `WarningsAsErrors: "*"`.

### 15.5 — App icon and resources
- [ ] Confirm `assets/app.icns` and tray icon (`resources/tray-icon.png` + `@2x` variant) exist.
- [ ] Update `mobrowser.conf.json` with `author`, `copyright`, `description`.

### 15.6 — Production build
- [ ] Run `npm run build` (or equivalent packaging command). Confirm the packaged `.app` launches,
  the Dock icon respects the preference, and the tray icon appears.
