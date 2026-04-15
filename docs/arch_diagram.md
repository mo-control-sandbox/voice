# moVoice — Architecture Diagrams

> Companion to `arch_essay.md`. All classes and public methods shown. Read together with the essay
> for rationale behind every design choice.

---

## 1 — System Overview (Four Runtimes)

```mermaid
flowchart TB
  subgraph MAIN["Main Process  (Node.js)"]
    direction TB
    APP[Application\ncomposition root]
    RSC[RecordingSession\nController]
    PREFS[Preferences\nService]
    SM[Shortcut\nManager]
    PC[Paste\nCoordinator]
    TR[Transcription\nRouter]
    MM[Model\nManager]
    MC[Model\nCatalog]
    HS[History\nStore]
    SFM[SessionFile\nManager]
    SC[Stats\nCalculator]
    TC[Tray\nController]
    WM[Window\nManager]

    subgraph IPC_LAYER["IPC Services  (thin boundary)"]
      direction LR
      RIS[Recording\nIpcService]
      SIS[Settings\nIpcService]
      HIS[History\nIpcService]
      MIS[Model\nIpcService]
      PIS[Permissions\nIpcService]
      STIS[Stats\nIpcService]
    end

    APP --> RSC & PREFS & SM & PC & TR & MM & HS & SC & TC & WM
    MM --> MC
    HS --> SFM
    TR --> MM
  end

  subgraph NATIVE["Native Module  (C++)"]
    SYS[SystemServiceImpl]
  end

  subgraph WORKER["Transcription Worker  (worker_threads)"]
    TW[TranscriptionWorker\n+ Transformers.js]
  end

  subgraph REC_WIN["Recording Renderer"]
    RA[RecordingApp]
  end

  subgraph SET_WIN["Settings Renderer"]
    SA[SettingsApp]
  end

  subgraph HIS_WIN["History Renderer"]
    HA[HistoryApp]
  end

  subgraph ABOUT_WIN["About Renderer"]
    AA[AboutApp]
  end

  MAIN -- "synchronous FFI call" --> NATIVE
  TR -- "postMessage / on('message')" --> WORKER

  REC_WIN -- "Protobuf RPC\n(GetStatus @ 30fps\nSubmitAudio on stop\nCancelRecording)" --> IPC_LAYER
  SET_WIN -- "Protobuf RPC\n(GetPreferences\nSetPreference\nGetModels etc.)" --> IPC_LAYER
  HIS_WIN -- "Protobuf RPC\n(GetSessions\nDeleteSession etc.)" --> IPC_LAYER
  ABOUT_WIN -- "Protobuf RPC\n(GetAppInfo)" --> IPC_LAYER
```

---

## 2 — Recording FSM

```mermaid
stateDiagram-v2
  [*] --> Idle

  Idle --> Recording : start()\n[mic permission granted]
  Idle --> Idle : start()\n[mic permission denied]\n→ notify user

  Recording --> Processing : stop()\n[shortcut / key-up]
  Recording --> Idle : cancel()\n→ discard audio, no history entry

  Processing --> Idle : complete(text)\n→ paste, save session, close window
  Processing --> Idle : error(e)\n→ notify user, close window
  Processing --> Idle : cancel()\n→ discard, close window, no history entry
  Processing --> Processing : shortcut pressed\n[no-op — guard]
```

---

## 3 — Main Process: Recording & Transcription Domains

```mermaid
classDiagram
  direction TB

  class RecordingSessionController {
    +start() Promise~void~
    +stop() void
    +cancel() void
    +submitAudio(pcm: Float32Array) Promise~void~
    +getState() RecordingState
    +onStateChange(callback: StateChangeCallback) void
  }

  class RecordingSession {
    +id: string
    +startedAt: number
    +capturedApp: CapturedApp
    +language: string | null
    +dontSaveAudio: boolean
    +dontSaveTranscripts: boolean
  }

  class TranscriptionService {
    <<interface>>
    +transcribe(audio: Float32Array, language: string|null) Promise~TranscriptionResult~
  }

  class TranscriptionRouter {
    +transcribe(audio: Float32Array, language: string|null) Promise~TranscriptionResult~
    +notifyModelChanged(model: ModelEntry) Promise~void~
  }

  class WhisperTranscriptionService {
    +transcribe(audio: Float32Array, language: string|null) Promise~TranscriptionResult~
    +loadModel(modelId: string) Promise~void~
    +isModelLoaded() boolean
  }

  class BuiltinSpeechTranscriptionService {
    +transcribe(audio: Float32Array, language: string|null) Promise~TranscriptionResult~
  }

  class TranscriptionWorker {
    +spawn() void
    +transcribe(audio: Float32Array, language: string|null) Promise~TranscriptionResult~
    +loadModel(modelId: string) Promise~void~
    +terminate() void
    +isReady() boolean
  }

  RecordingSessionController --> RecordingSession : creates (per session)
  RecordingSessionController --> TranscriptionService : delegates transcription
  TranscriptionRouter ..|> TranscriptionService
  WhisperTranscriptionService ..|> TranscriptionService
  BuiltinSpeechTranscriptionService ..|> TranscriptionService
  TranscriptionRouter --> WhisperTranscriptionService
  TranscriptionRouter --> BuiltinSpeechTranscriptionService
  WhisperTranscriptionService --> TranscriptionWorker
```

---

## 4 — Main Process: System Integration & Preferences

```mermaid
classDiagram
  direction TB

  class Application {
    +initialize() Promise~void~
    +shutdown() void
    -buildObjectGraph() void
    -registerIpcServices() void
    -startupSequence() Promise~void~
  }

  class PreferencesService {
    +get~T~(key: PreferenceKey) T
    +set~T~(key: PreferenceKey, value: T) void
    +getAll() Preferences
  }

  class ShortcutManager {
    +register(shortcut: string, mode: ShortcutMode) void
    +unregister() void
    +update(shortcut: string, mode: ShortcutMode) void
  }

  class PasteCoordinator {
    +paste(text: string, target: CapturedApp) Promise~PasteResult~
  }

  class TrayController {
    +initialize() void
    +refresh() void
  }

  class WindowManager {
    +showRecordingWindow() void
    +transitionRecordingWindowToProcessing() void
    +hideRecordingWindow() void
    +showSettings(page?: SettingsPage) void
    +showHistory() void
    +showAbout() void
  }

  Application --> PreferencesService
  Application --> ShortcutManager
  Application --> PasteCoordinator
  Application --> TrayController
  Application --> WindowManager
  TrayController --> WindowManager
  TrayController --> PreferencesService
```

---

## 5 — Main Process: Model Management & Storage

```mermaid
classDiagram
  direction TB

  class ModelCatalog {
    +getAll() ModelDefinition[]
    +getById(id: string) ModelDefinition
  }

  class ModelManager {
    +initialize() Promise~void~
    +getModels() ModelEntry[]
    +getActiveModel() ModelEntry
    +setActiveModel(modelId: string) void
    +downloadModel(modelId: string, onProgress: ProgressCallback) Promise~void~
    +cancelDownload(modelId: string) void
    +deleteModel(modelId: string) void
    +revealInFinder(modelId: string) void
    +getStoragePath() string
    +updateStoragePath(path: string) Promise~void~
    +onActiveModelChanged(callback: ModelChangeCallback) void
  }

  class HistoryStore {
    +initialize() void
    +addSession(record: SessionRecord) void
    +getSessions() SessionRecord[]
    +getSession(id: string) SessionRecord
    +deleteSession(id: string) Promise~void~
    +revealAudioFile(id: string) void
    +revealTranscriptFile(id: string) void
  }

  class SessionFileManager {
    +getSessionDir(sessionId: string) string
    +getAudioPath(sessionId: string) string
    +getTranscriptPath(sessionId: string) string
    +saveAudio(sessionId: string, pcm: Float32Array) Promise~void~
    +saveTranscript(sessionId: string, text: string) Promise~void~
    +deleteSessionFiles(sessionId: string) Promise~void~
    +fileExists(path: string) boolean
  }

  class StatsCalculator {
    +compute(sessions: SessionRecord[]) DashboardStats
  }

  ModelManager --> ModelCatalog
  HistoryStore --> SessionFileManager
  HistoryStore --> StatsCalculator : (data source for stats)
```

---

## 6 — IPC Services Layer

```mermaid
classDiagram
  direction LR

  class RecordingIpcService {
    <<IPC Handler>>
    +GetStatus(Empty) RecordingStatusResponse
    +CancelRecording(Empty) Empty
    +SubmitAudio(SubmitAudioRequest) Empty
  }

  class SettingsIpcService {
    <<IPC Handler>>
    +GetPreferences(Empty) PreferencesResponse
    +SetPreference(SetPreferenceRequest) Empty
  }

  class HistoryIpcService {
    <<IPC Handler>>
    +GetSessions(Empty) SessionListResponse
    +DeleteSession(SessionIdRequest) Empty
    +RevealAudioFile(SessionIdRequest) Empty
    +RevealTranscriptFile(SessionIdRequest) Empty
    +GetAudioUrl(SessionIdRequest) StringResponse
  }

  class ModelIpcService {
    <<IPC Handler>>
    +GetModels(Empty) ModelListResponse
    +DownloadModel(ModelIdRequest) Empty
    +CancelDownload(ModelIdRequest) Empty
    +DeleteModel(ModelIdRequest) Empty
    +SetActiveModel(ModelIdRequest) Empty
    +GetDownloadProgress(ModelIdRequest) DownloadProgressResponse
    +PickStoragePath(Empty) StringResponse
    +SetStoragePath(PathRequest) Empty
  }

  class PermissionsIpcService {
    <<IPC Handler>>
    +GetPermissions(Empty) PermissionsResponse
    +OpenSystemSettings(PermissionTypeRequest) Empty
    +RefreshPermissions(Empty) PermissionsResponse
  }

  class StatsIpcService {
    <<IPC Handler>>
    +GetStats(Empty) DashboardStatsResponse
  }

  class AppIpcService {
    <<IPC Handler>>
    +GetAppInfo(Empty) AppInfoResponse
  }

  RecordingIpcService --> RecordingSessionController
  SettingsIpcService --> PreferencesService
  HistoryIpcService --> HistoryStore
  ModelIpcService --> ModelManager
  PermissionsIpcService --> SystemServiceImpl
  StatsIpcService --> StatsCalculator
  StatsIpcService --> HistoryStore
```

---

## 7 — Native Module

```mermaid
classDiagram
  class SystemServiceImpl {
    <<C++ Native>>
    +CaptureFrontmostApp(Empty) CapturedAppResponse
    +ActivateAndPaste(ActivateRequest) ActivateResult
    +MonitorKeyUp(MonitorKeyUpRequest) Empty
    +StopKeyUpMonitor(Empty) Empty
    +SetLaunchAtLogin(BoolRequest) Empty
    +GetPermissionsStatus(Empty) PermissionsStatusResponse
    +OpenSystemSettings(PermissionTypeRequest) Empty
    +RunBuiltinSpeechRecognition(SpeechRequest) SpeechResponse
    +RevealInFinder(PathRequest) Empty
  }

  note for SystemServiceImpl "Cocoa APIs used internally:\nNSRunningApplication / NSWorkspace → CaptureFrontmostApp, ActivateAndPaste\nCGEventTap → MonitorKeyUp, StopKeyUpMonitor\nSMAppService → SetLaunchAtLogin\nAVCaptureDevice + SFSpeechRecognizer + AXIsProcessTrusted → GetPermissionsStatus\nNSWorkspace.activateFileViewerSelectingURLs → RevealInFinder\nSFSpeechRecognizer → RunBuiltinSpeechRecognition"
```

---

## 8 — Renderer: Recording Window

```mermaid
classDiagram
  direction TB

  class RecordingApp {
    <<React component>>
    -state: RecordingState
    -audioContext: AudioContext | null
    -audioStream: MediaStream | null
    -pcmChunks: Float32Array[]
    +render()
  }

  class WaveformVisualizer {
    <<React component>>
    +render()
    note: AnalyserNode amplitude is\nUI-only; no IPC involved
  }

  class ProcessingIndicator {
    <<React component>>
    +render()
  }

  class CancelButton {
    <<React component>>
    +onCancel: () => void
    +render()
  }

  RecordingApp *-- WaveformVisualizer : shown while recording
  RecordingApp *-- ProcessingIndicator : shown while processing
  RecordingApp *-- CancelButton
```

**Audio capture pipeline (renderer-owned, no IPC until submit):**

```mermaid
flowchart LR
  GUM["getUserMedia\n{ audio: true }"] --> AC["AudioContext"]
  AC --> AWN["AudioWorkletNode\n(accumulates PCM chunks)"]
  AC --> AN["AnalyserNode\n(amplitude → WaveformVisualizer)"]
  AWN --> STOP{on stop}
  STOP --> OAC["OfflineAudioContext\n(resample → 16 kHz mono)"]
  OAC --> IPC["ipc.recording\n.SubmitAudio(pcm)"]
```

---

## 9 — Renderer: Settings Window

```mermaid
classDiagram
  direction TB

  class SettingsApp {
    <<React component>>
    -currentPage: SettingsPage
    +render()
  }

  class DashboardPage {
    <<React component>>
    -stats: DashboardStats
    +render()
  }

  class GeneralPage {
    <<React component>>
    -preferences: Preferences
    +render()
  }

  class ModelsPage {
    <<React component>>
    -models: ModelEntry[]
    +render()
    note: polls GetDownloadProgress\nat 2 fps while download active
  }

  class PermissionsPage {
    <<React component>>
    -permissions: PermissionStatus[]
    +render()
  }

  class ShortcutConfigurator {
    <<React component>>
    +currentShortcut: string
    +mode: ShortcutMode
    +onChange: ShortcutChangeCallback
    +render()
  }

  class ModelCard {
    <<React component>>
    +model: ModelEntry
    +onDownload: () => void
    +onCancelDownload: () => void
    +onDelete: () => void
    +onSetActive: () => void
    +onReveal: () => void
    +render()
  }

  class PermissionRow {
    <<React component>>
    +permission: PermissionStatus
    +onOpenSettings: () => void
    +render()
  }

  SettingsApp *-- DashboardPage
  SettingsApp *-- GeneralPage
  SettingsApp *-- ModelsPage
  SettingsApp *-- PermissionsPage
  GeneralPage *-- ShortcutConfigurator
  ModelsPage *-- ModelCard
  PermissionsPage *-- PermissionRow
```

---

## 10 — Renderer: History Window

```mermaid
classDiagram
  direction TB

  class HistoryApp {
    <<React component>>
    -sessions: SessionRecord[]
    -selectedId: string | null
    +render()
  }

  class SessionList {
    <<React component>>
    +sessions: SessionRecord[]
    +selectedId: string | null
    +onSelect: (id: string) => void
    +render()
  }

  class SessionItem {
    <<React component>>
    +session: SessionRecord
    +isSelected: boolean
    +onSelect: () => void
    +render()
  }

  class SessionDetail {
    <<React component>>
    +session: SessionRecord
    +onDelete: () => void
    +onRevealAudio: () => void
    +onRevealTranscript: () => void
    +render()
  }

  class AudioPlayer {
    <<React component>>
    +audioPath: string | null
    +disabled: boolean
    +render()
  }

  HistoryApp *-- SessionList
  HistoryApp *-- SessionDetail
  SessionList *-- SessionItem
  SessionDetail *-- AudioPlayer
```

---

## 11 — IPC Communication Map

```mermaid
flowchart LR
  subgraph REC["Recording Window"]
    RA2[RecordingApp]
  end
  subgraph SET["Settings Window"]
    SA2[SettingsApp]
  end
  subgraph HIS["History Window"]
    HA2[HistoryApp]
  end
  subgraph ABT["About Window"]
    AA2[AboutApp]
  end

  subgraph SERVICES["IPC Services → Domain"]
    direction TB
    R_SVC["RecordingIpcService\n→ RecordingSessionController"]
    S_SVC["SettingsIpcService\n→ PreferencesService"]
    H_SVC["HistoryIpcService\n→ HistoryStore"]
    M_SVC["ModelIpcService\n→ ModelManager"]
    P_SVC["PermissionsIpcService\n→ SystemServiceImpl"]
    ST_SVC["StatsIpcService\n→ StatsCalculator"]
    A_SVC["AppIpcService\n→ app metadata"]
  end

  RA2 -- "GetStatus (30fps)\nSubmitAudio\nCancelRecording" --> R_SVC
  SA2 -- "GetPreferences\nSetPreference" --> S_SVC
  SA2 -- "GetModels\nDownloadModel\nSetActiveModel\nPickStoragePath\nSetStoragePath\nGetDownloadProgress (2fps)" --> M_SVC
  SA2 -- "GetPermissions\nOpenSystemSettings\nRefreshPermissions" --> P_SVC
  SA2 -- "GetStats" --> ST_SVC
  HA2 -- "GetSessions\nDeleteSession\nRevealAudioFile\nRevealTranscriptFile\nGetAudioUrl" --> H_SVC
  AA2 -- "GetAppInfo" --> A_SVC
```

---

## 12 — Full Dependency Graph (Main Process)

```mermaid
flowchart TD
  APP[Application]

  APP --> RSC[RecordingSession\nController]
  APP --> PREFS[PreferencesService]
  APP --> SM[ShortcutManager]
  APP --> PC[PasteCoordinator]
  APP --> TR[TranscriptionRouter]
  APP --> MM[ModelManager]
  APP --> HS[HistoryStore]
  APP --> SC[StatsCalculator]
  APP --> TC[TrayController]
  APP --> WM[WindowManager]

  RSC --> PREFS
  RSC --> TR
  RSC --> PC
  RSC --> HS
  RSC --> SFM[SessionFileManager]
  RSC --> WM

  TR --> MM
  TR --> WTS[WhisperTranscription\nService]
  TR --> BTS[BuiltinSpeechTranscription\nService]

  WTS --> TW[TranscriptionWorker]
  BTS --> SYS[SystemServiceImpl\nC++ native]

  MM --> MC[ModelCatalog]
  MM --> PREFS

  HS --> SFM
  SFM --> PREFS

  PC --> SYS
  SM --> SYS

  TC --> MM
  TC --> PREFS
  TC --> WM
  TC --> RSC

  WM --> RSC
```
