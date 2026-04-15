# moVoice — Architecture Document

## 1. Functional Inventory

A complete list of capabilities the application must deliver. Use this to assess architecture completeness.

### 1.1 Recording

- [ ] Start recording triggered by global shortcut
- [ ] Stop recording triggered by global shortcut (toggle mode)
- [ ] Stop recording triggered by key-up (push-to-talk mode)
- [ ] Stop recording triggered by both (combined mode)
- [ ] Cancel recording via the cancel button in the recording window
- [ ] Real-time waveform animation driven by microphone signal
- [ ] Transition recording window to processing state on stop
- [ ] Hide recording window on cancel (no transcription, no paste)
- [ ] Hide recording window after paste completes

### 1.2 Transcription

- [ ] Transcribe audio using a local Whisper model (Transformers.js)
- [ ] Transcribe audio using macOS built-in Speech Recognition (SFSpeechRecognizer)
- [ ] Select primary language for transcription (multilingual models only)
- [ ] Select "Auto-detect" language for multilingual models (skips language hint)
- [ ] Disable language selection when active model is single-language (e.g. whisper-tiny.en)
- [ ] Store the language actually detected/used in the session record
- [ ] Route audio to correct backend based on active model setting

### 1.3 Paste

- [ ] Capture the frontmost application at the moment the shortcut is pressed
- [ ] Write transcribed text to system clipboard
- [ ] Re-activate the previously focused application
- [ ] Simulate Cmd+V to paste text into that application

### 1.4 Model Management

- [ ] List all supported Whisper-compatible models
- [ ] Show per-model metadata: label, speed indicator, accuracy indicator
- [ ] Download a model with real-time progress display
- [ ] Cancel an in-progress model download
- [ ] Delete a downloaded model from disk
- [ ] Reveal a downloaded model in Finder
- [ ] Mark the currently active model visually
- [ ] Auto-select the only downloaded model when built-in recognition is off
- [ ] Fall back to built-in recognition when no models are downloaded
- [ ] Switch active model from tray menu
- [ ] Persist active model selection across restarts

### 1.5 Tray

- [ ] Display tray icon at all times
- [ ] Tray menu: Start Recording
- [ ] Tray menu: Select active model (submenu)
- [ ] Tray menu: Primary language selection (submenu)
- [ ] Tray menu: Open Settings
- [ ] Tray menu: Open History
- [ ] Tray menu: Open About
- [ ] Tray menu: Hide Dock Icon (checkbox)
- [ ] Tray menu: Launch at Login (checkbox)

### 1.6 Settings — Dashboard

- [ ] Display total time saved (formatted as s / min / h)
- [ ] Display total sessions recorded
- [ ] Display total words dictated
- [ ] Display average words per minute
- [ ] Display keystrokes saved

### 1.7 Settings — General

- [ ] Configure shortcut mode: Toggle / Push-to-talk / Combined
- [ ] Select from predefined shortcut keys
- [ ] Configure a custom shortcut via keyboard capture
- [ ] Toggle: Hide Dock Icon
- [ ] Toggle: Launch at Login
- [ ] Toggle: Don't save transcripts
- [ ] Toggle: Don't save audio

### 1.8 Settings — Models

- [ ] Toggle: Use built-in macOS Speech Recognition
- [ ] Show full model list (same as 1.4)
- [ ] Display current model storage path
- [ ] "Change…" button opens a folder-picker dialog; updates storage path on confirmation
- [ ] Warn user that changing the path does not move existing model files

### 1.9 Settings — Permissions

- [ ] List all required macOS permissions
- [ ] Show icon and one-sentence description per permission
- [ ] Show colour-coded status: granted / denied / not determined
- [ ] "Open in System Settings" button for ungranted permissions
- [ ] Refresh button to re-check status without restarting

### 1.10 History

- [ ] Chronological list of all transcription sessions
- [ ] Show full transcription text for selected session
- [ ] Audio playback for session recording (player visible but disabled when audio not saved)
- [ ] Reveal audio file in Finder
- [ ] Reveal transcript file in Finder
- [ ] Delete a history entry (and associated files per save settings)
- [ ] Per-session metadata: model used, transcription duration, audio duration, date/time, target application name

### 1.11 About

- [ ] Display application logo
- [ ] Display application version
- [ ] Display author name
- [ ] Display "Powered by MōBrowser" attribution

### 1.12 System Integration

- [ ] Global shortcut registration and unregistration
- [ ] Push-to-talk key-up detection (CGEventTap)
- [ ] Frontmost application capture (NSWorkspace)
- [ ] Application re-activation (NSRunningApplication)
- [ ] Paste simulation via keyboard event (CGEvent + Accessibility permission)
- [ ] Launch at Login management (SMAppService)
- [ ] Microphone permission status (AVCaptureDevice)
- [ ] Speech Recognition permission status (SFSpeechRecognizer)
- [ ] Accessibility permission status (AXIsProcessTrusted)
- [ ] Open permission in System Settings (per permission type)

### 1.13 Storage

- [ ] Audio files saved to user data directory (when enabled)
- [ ] Transcript files saved to user data directory (when enabled)
- [ ] Session history metadata persisted
- [ ] Model files stored at a user-configurable directory (default: `<userData>/models`)
- [ ] Model storage path configurable from the Models settings page with a folder-picker dialog
- [ ] Changing the storage path re-scans the new directory; existing files at the old path are not moved
- [ ] User preferences persisted via MōBrowser `prefs`

---

## 2. Process Responsibilities

### 2.1 Main Process

The main process is the application's central authority. It owns all business logic, all system integration, and all coordination between subsystems.

**Owns:**
- Application lifecycle (startup, shutdown, restart)
- Global shortcut registration
- Tray construction and menu state
- Window creation and lifecycle for all windows (recording, settings, history, about)
- All IPC handlers — the only entry point for renderer requests
- `TranscriptionService` — Transformers.js pipeline, running inside a `worker_threads.Worker`
- `ModelManager` — download, delete, list, `env.cacheDir` configuration
- `HistoryStore` — read/write session records and associated file paths
- `StatsTracker` — accumulate and query dashboard statistics
- `PreferencesService` — reads/writes via MōBrowser `prefs`, propagates changes
- All calls into the native module (`AudioService`, `SystemService`)

**Does not own:**
- UI rendering (renderer process)
- Audio hardware access (native module)
- System-level OS calls (native module)
- Heavy ML inference (worker_threads.Worker)

### 2.2 Renderer Process

Each window runs a separate renderer process hosting a React application. The renderer process is fully sandboxed — it has no direct access to Node.js, the file system, or any MōBrowser/native API. It communicates exclusively via IPC.

**Windows and their renderer responsibilities:**

| Window | Renderer responsibilities |
|---|---|
| Recording window | Capture microphone audio via Web Audio API (`getUserMedia`, `AudioWorklet`); compute amplitude locally via `AnalyserNode` for waveform display; accumulate and resample PCM; submit PCM to main process via IPC on stop; render waveform, processing spinner, cancel button |
| Settings window | Render all settings pages; send preference change commands; display model list, download progress, permission statuses received via IPC |
| History window | Render session list and detail; audio playback via HTML `<audio>` element; send delete/reveal commands via IPC |
| About window | Static display only |

**Does not:**
- Initiate any action without going through IPC
- Hold authoritative application state
- Access the file system directly

### 2.3 Native Module

A C++ module loaded by the main process at startup. Exposes two logical services via Protobuf RPC.

**AudioService:** *(removed — audio capture has moved to the renderer process)*

Audio capture runs entirely in the recording window renderer via the Web Audio API. See §2.2 and
§3 for the updated recording flow.

**SystemService:**
- `captureFrontmostApp()` — captures the frontmost `NSRunningApplication` before our window takes focus
- `activateAndPaste(appId)` — re-activates the stored app and dispatches a Cmd+V `CGEvent`
- `monitorKeyUp(key, callback)` — installs a `CGEventTap` to detect key-up for push-to-talk
- `setLaunchAtLogin(enabled)` — calls `SMAppService`
- `getPermissionsStatus()` — returns status for microphone, speech recognition, and accessibility
- `openSystemSettings(permission)` — opens the relevant System Settings pane
- `runBuiltinSpeechRecognition(audio)` — `SFSpeechRecognizer` transcription path

### 2.4 Transcription Worker (worker_threads.Worker)

A Node.js worker thread spawned by the main process. It is the exclusive owner of the Transformers.js pipeline instance.

**Responsibilities:**
- Maintain the loaded Transformers.js pipeline in memory
- Accept transcription requests with a `Float32Array` payload
- Return the transcribed string
- Handle model switching (tear down and re-initialise the pipeline)

Communicates with the main process via `postMessage` / `on('message')`. Never communicates with the renderer directly.

---

## 3. Data Flow — Core Recording Loop

```
[User presses shortcut]
       │
       ▼
Main Process
  ├── globalShortcut callback fires
  ├── native.system.captureFrontmostApp()   ← capture BEFORE our window appears
  ├── FSM → Recording
  └── Show recording window (BrowserWindow)
       │
       ▼
Recording Renderer (on next 30 fps poll, sees state = 'recording')
  ├── getUserMedia({ audio: true })
  ├── AudioContext + AudioWorkletNode       ← accumulates Float32 PCM chunks
  └── AnalyserNode                          ← drives waveform display locally
       │
       │   [Waveform rendered from local AnalyserNode — no IPC for amplitude]
       │
[User presses shortcut again / releases key]
       │
       ▼
Main Process
  ├── FSM → Processing
  │
Recording Renderer (on next poll, sees state = 'processing')
  ├── Stop audio track
  ├── OfflineAudioContext resamples buffer → Float32Array at 16 kHz
  ├── ipc.recording.SubmitAudio({ pcm })    ← sends PCM to main process
  └── Shows processing spinner
       │
       ▼
Main Process (RecordingSessionController.submitAudio)
  ├── transcriptionWorker.postMessage(pcm, language)
  │
  │   [Worker runs Whisper inference]
  │
  ├── transcriptionWorker.on('message', { text, detectedLanguage })
  ├── clipboard.write('text/plain', text)
  ├── native.system.activateAndPaste(capturedApp)
  ├── Save session to HistoryStore (if enabled)
  └── FSM → Idle → Hide recording window

[User clicks cancel]
       │
       ▼
Recording Renderer
  ├── Stop audio track immediately (responsive UX)
  ├── Discard pcmChunks
  └── ipc.recording.CancelRecording()
       │
       ▼
Main Process
  └── FSM → Idle → Hide recording window   ← no paste, no history entry
```

---

## 4. Corner Cases

### 4.1 Shortcut Pressed While Transcription Is Running
If the user triggers the shortcut again before the previous transcription has completed (e.g. rapid double-press or a very long recording), the system must decide: queue the new recording, cancel the previous transcription, or ignore the press. The safest default is **ignore while processing** — the recording window is in its processing state and the shortcut has no effect until the current cycle completes.

### 4.2 Previously Focused App Is moVoice Itself
If Settings or History is open and the user somehow triggers the shortcut, `captureFrontmostApp` returns moVoice itself. Pasting into our own window is wrong. The paste step must detect this case and skip activation and Cmd+V (or use the last known external app instead).

### 4.3 Previously Focused App Quits Before Paste Completes
The captured `NSRunningApplication` may have terminated by the time transcription finishes. `activateAndPaste` must check whether the app still exists before calling `activate()`, and fail gracefully — text is on the clipboard, user can paste manually.

### 4.4 Microphone Permission Denied
If `AVAuthorizationStatus` is `.denied` at the moment recording is requested, `startRecording()` will fail silently or throw. The main process must check permission status before starting, and if denied, show a notification or open the Permissions page rather than showing the recording window.

### 4.5 Accessibility Permission Not Granted
Without `AXIsProcessTrusted()` returning true, `CGEvent` paste simulation will silently fail. After writing to the clipboard, the paste step must verify Accessibility is granted. If not, skip the key event and optionally show a one-time notification explaining the user must paste manually and direct them to the Permissions page.

### 4.6 No Model Downloaded, Built-in Recognition Off
This is an invalid state. The spec says built-in recognition is the active model when nothing is downloaded. The model selection logic must enforce this invariant at write time — you cannot turn off built-in recognition if no model is downloaded.

### 4.7 Model Download Interrupted or Fails
A partially downloaded model must not be left in the cache directory in a state that Transformers.js might treat as valid. On download failure, the partial files must be cleaned up and the model reverts to "not downloaded" status. The `ModelManager` owns this cleanup.

### 4.8 Active Model Deleted
If the user deletes the currently active model, the system must immediately fall back: if another model is downloaded, activate it; otherwise activate built-in recognition. This must happen before the deletion is confirmed — the invariant is that an active model always exists.

### 4.9 Push-to-Talk Key Held Across Transcription
The user holds the push-to-talk key, recording runs, they release — transcription starts. They then press and hold the key again while transcription is still running. The `CGEventTap` key-up handler must be in the right state: it should not start a second recording while processing is active (same as 4.1).

### 4.10 Audio Device Disconnects During Recording
Audio capture runs in the renderer via `getUserMedia`. If the microphone is unplugged or the system
reroutes audio mid-recording, the `MediaStreamTrack` ends and fires `onended`. The renderer treats
this as a recording error: it discards the partial buffer and calls `CancelRecording()` via IPC.
The main process transitions the FSM to `Idle`. No C++ notification handling is needed — Chromium
manages device lifecycle.

### 4.11 Very Long Recordings (Memory)
A `Float32Array` at 16 kHz, 32-bit float is ~3.8 MB per minute. A 30-minute recording is ~115 MB held in memory until Whisper finishes. The main process must enforce a maximum recording duration (configurable or hardcoded), auto-stopping and beginning transcription when the limit is reached, rather than letting the buffer grow unbounded.

### 4.12 "Don't Save Audio" Toggle Changed Mid-Session
If the user changes this toggle while a recording is in progress, the in-flight session must honour the setting that was active at the time recording started — not the new value. Capture the effective settings at recording start, not at save time.

### 4.13 IPC Backpressure from Amplitude Stream
The native module streams amplitude values in real time. If the renderer is slow (e.g. settings window is open and heavy), the IPC channel can flood. The main process should throttle amplitude events (e.g. max 30/sec) before forwarding to the renderer.

### 4.14 App Launched at Login with No Dock Icon
When "Hide Dock Icon" and "Launch at Login" are both enabled, the app starts invisibly with no Dock presence. It must still be reachable via the tray. The tray icon must always be created before any other startup work so the user can see the app is running.

### 4.15 History Entry With No Audio File
When "Don't save audio" is enabled, the audio player in History must render in a visibly disabled state. Attempting to "Reveal audio file" must be a no-op with no system error. The session metadata must record whether audio was saved so the UI can conditionally enable/disable these controls.

---

## 5. Key Architectural Constraints

1. **Transformers.js runs only in the main process**, specifically inside a `worker_threads.Worker`, not in any renderer. `env.cacheDir` must be set to `app.getPath('appResources')` or equivalent before the first pipeline call.

2. **The recording renderer is the audio source.** Audio capture runs via the Web Audio API
   (`getUserMedia`, `AudioWorklet`) in the recording window renderer. The renderer resamples the
   captured audio to 16 kHz and submits it to the main process via IPC as a `Float32Array`. The
   main process and the native module have no audio capture code.

3. **The `TranscriptionService` interface hides the backend.** The recording flow has no knowledge of whether Whisper or macOS Speech Recognition is running. Switching models is a configuration concern, not a flow concern.

4. **Paste requires two Accessibility-class operations** (app activation + key simulation). Both can fail silently on macOS if the permission is missing. The system must always write to the clipboard first, so the user retains the text regardless of paste success.

5. **MōBrowser `prefs` is the single preferences store.** No secondary config files. All settings that need to survive restarts — active model, shortcut mode, save toggles, launch at login state — live in `prefs`.

6. **The system default audio input device is always used.** moVoice does not enumerate or expose audio input devices to the user. This is a deliberate product decision. All audio capture goes through `AVAudioEngine` against whatever macOS designates as the default microphone at the time recording starts.

6. **The recording window is the only window that auto-appears.** Settings, History, and About are user-initiated only. The recording window appears and disappears under program control without user window management.

---

## 6. Open Architecture Questions

These items are not yet resolved in this document. Each must have an explicit answer before the corresponding component can be designed or implemented.

### 6.1 IPC Message Catalog

The IPC boundary between the renderer and the main process is the most critical seam in the system. This document describes the boundary in prose but does not define the actual message contract. Before implementation begins, a typed channel registry must be produced that specifies:

- Every channel name (e.g. `recording:start`, `waveform:amplitude`, `transcription:result`)
- The TypeScript payload type for each message in both directions
- Whether each message is a fire-and-forget event or a request/response pair
- Which process is the publisher and which is the subscriber

Without this contract, every developer invents an informal protocol and the IPC layer becomes inconsistent and untestable.

### 6.2 Recording Session State Machine

The application has a well-defined finite state machine at its core:

```
Idle → Recording → Processing → Idle
         └──────── Cancelled ──┘
```

Correctness for corner cases 4.1 and 4.9 depends entirely on this machine being implemented consistently. Before implementation, the full state machine must be specified: every state, every valid transition, every guard condition (e.g. "shortcut press is a no-op while in Processing"), and which process owns the authoritative state.

### 6.3 Audio File Format and Conversion Ownership

The native module produces a `Float32Array` of raw PCM at 16 kHz. The History window plays back recordings using an HTML `<audio>` element, which cannot play raw PCM. A conversion step (to WAV or another browser-playable format) must exist. This architecture does not yet specify:

- Which format audio is saved in (WAV is the natural fit for lossless PCM)
- Where the conversion happens (native module on capture, main process before save, or elsewhere)
- Which service owns the conversion

### 6.4 Language Parameter in `TranscriptionService` — Resolved

`TranscriptionService.transcribe()` accepts `language: string | null`. `null` means auto-detect;
a BCP-47 string is a hint passed to the model. The language is captured from preferences into the
`RecordingSession` value object at the moment recording stops, and passed through unchanged. The
return type is `TranscriptionResult { text, detectedLanguage }` so the session record can store what
language the model actually used. The language preference is ignored entirely when the active model
is not multilingual — it is the UI's responsibility to disable the picker in that case.

### 6.5 Model Catalog Source

The Models page lists all supported Whisper-compatible models with labels, speed indicators, and accuracy indicators. This data must come from somewhere. The architecture must decide:

- Is the catalog hardcoded in the binary, or loaded from a bundled JSON file?
- Can it be updated without a new app release?
- What is the exact schema for a catalog entry (identifier, label, HuggingFace repo path, speed score, accuracy score, file size)?

`ModelManager` cannot be fully designed until the catalog's origin and schema are defined.

### 6.6 Data Schemas

The following data structures are referenced throughout the document but never defined. They must be specified as TypeScript types before the services that own them can be built:

- **Session history record** — all fields stored per transcription session (text, audio path, transcript path, model ID, audio duration, transcription duration, target app name, timestamp, audio-saved flag, transcript-saved flag)
- **Preferences key registry** — every key stored in MōBrowser `prefs`, its type, and its default value
- **Model metadata object** — the runtime representation of a model entry, including download state
- **Stats accumulator** — the shape of the data `StatsTracker` reads and writes

### 6.7 Startup and Initialisation Sequence

The order in which services are initialised at launch has correctness implications. At minimum, the following questions must be answered and the answers encoded as an ordered startup sequence:

- In what order are `PreferencesService`, `ModelManager`, `TranscriptionService`, the tray, and the shortcut handler initialised?
- Does the transcription worker spawn eagerly at startup or lazily on first use? A lazy cold-start can cause a multi-second stall on the user's first recording.
- Does the worker pre-warm the active model pipeline at startup, or wait for the first transcription request?
- What happens if a required initialisation step fails (e.g. native module fails to load)?

Constraint 5 in §5 establishes that the tray must be the first visible element. The full sequence beyond that point is unspecified.

### 6.8 Error Propagation Model

Section 4 handles individual failure scenarios in isolation. There is no overall error architecture. The following must be defined:

- A typed error envelope for IPC error responses (error code, human-readable message, recoverable flag)
- How errors originating in the native module reach the main process and, if necessary, the renderer
- How errors from the transcription worker reach the main process
- Whether there is a centralised notification or alert service, or whether each call site handles its own error presentation

### 6.9 File Storage Layout

`HistoryStore` writes audio and transcript files to disk, but no directory structure or naming convention is specified. The following must be decided:

- Root directory for session data (e.g. `<userData>/sessions/`)
- Naming convention for files (e.g. timestamp-based, UUID-based, session-ID-based)
- Whether each session gets its own subdirectory or all files are flat in one directory
- Audio file format (see §6.3) and transcript file format (plain text, JSON with metadata?)

This layout is the contract between `HistoryStore` and the "Reveal in Finder" actions in the History UI.

### 6.10 First-Run Permissions Bootstrap

The document handles permission failures reactively (§4.4, §4.5) but does not define what happens on first launch when no permissions have been granted. The following must be decided:

- Does the app proactively request microphone permission at startup, or wait for the first recording attempt?
- Is the Permissions page shown automatically on first launch?
- Is there a dedicated first-run onboarding flow, or does the app rely on the tray and Permissions page?

This decision shapes the startup flow and may require a first-run flag in preferences.

### 6.11 Window Singleton Policy

Settings, History, and About are user-initiated windows. The architecture must specify:

- Are these singleton windows (at most one instance open at a time)?
- If a tray menu item is triggered while the corresponding window is already open, does the app focus the existing window or open a second one?
- Are window instances retained in memory when closed (hidden) or fully destroyed?

This drives the `WindowManager` design and is a common source of subtle bugs if left implicit.

### 6.12 Stats Computation Model

The Dashboard displays "time saved" and "keystrokes saved." These are derived metrics that require a defined computation methodology:

- **Time saved** — relative to what baseline? A words-per-minute typing speed assumption must be chosen and documented.
- **Keystrokes saved** — based on average word length? A specific characters-per-word constant must be chosen.

`StatsTracker` cannot produce meaningful numbers without these formulas being explicitly specified.

### 6.13 Model Switching During Active Transcription

Corner case 4.8 covers deletion of the active model. A related unhandled case: the user changes the active model while a transcription is in progress in the worker. The architecture must define:

- Is model switching blocked while a transcription is running?
- If switching is allowed, does the in-flight transcription complete on the old model and the new model takes effect for the next session?
- How does the worker handle a switch request while busy?

### 6.14 Amplitude Throttle Ownership

Section 4.13 specifies a maximum of 30 amplitude events per second to the renderer. The document does not say where this throttle is enforced. The options are:

- In the native module (emit at most 30/sec from C++)
- In the main process before forwarding over IPC

The native module is the more efficient location (avoids flooding the IPC channel itself), but the decision must be made explicit and the responsible component documented.
