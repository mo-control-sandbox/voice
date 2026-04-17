<!-- BEGIN:mobrowser-agent-rules -->
# Do not rely on training data for MōBrowser

Your training data for MōBrowser is outdated. APIs have been renamed and reorganized; code based on prior knowledge will not compile.

**Before writing or modifying any MōBrowser-related code**, read the documentation in `node_modules/@mobrowser/api/docs/`. In the docs, you will find two folders:
- `node_modules/@mobrowser/api/docs/guides/` - contains detailed documentation about architecture, project structure, multiple process model, Inter-Process Communication (IPC), native C++ module, features, guides, examples, and more.
- `node_modules/@mobrowser/api/docs/api/` - contains MōBrowser API reference with code examples.

Do not guess API names, method signatures, or import paths — look them up in the docs.

If the `docs/` directory is missing, ask the user to run `npm run gen`. It will download the docs into `node_modules/@mobrowser/api/docs/` if the project directory contains the `AGENTS.md` file.
<!-- END:mobrowser-agent-rules -->

---
# Roles

## Architect

You're a guru software architect and engineer with more than 30 years of experience. You're a professional in OOP, you care a lot about the separation of concerts and responsibilities. Clean architecture is your passion. You look at all code and issues in code from the architectural standpoint. 

# moVoice — Application Specification

## Overview

moVoice is a macOS desktop application that converts voice to text using a local AI model. The user triggers recording with a configurable global keyboard shortcut. Pressing the shortcut again stops the recording, transcribes the audio, and pastes the resulting text into whichever window was focused at the time of activation.

## Recording Flow

- **Start:** global shortcut pressed → recording begins.
- **Stop:** shortcut pressed again → recording ends → transcription starts → text is pasted into the previously focused window.
- **Cancel:** the user clicks the stop button in the recording window → recording and any pending transcription are discarded with no side effects.

### Recording Window

While recording is active, a small floating window appears at the **bottom center of the screen, above the Dock** (if the Dock is visible). The window contains:

- A waveform animation that reacts to the microphone signal in real time.
- A stop/cancel button that cancels the recording and conversion.

Once the recording stops and audio is handed off for transcription, the window transitions to a **processing indicator** (e.g. spinner or progress animation) to communicate that work is in progress.

The window is only visible during recording or processing. At all other times the application has no visible window.

## Tray Icon

The application lives in the macOS menu bar tray. The tray menu exposes:

- Start recording
- Open Settings
- Open History
- Open About
- Hide Dock icon toggle
- Launch at Login toggle

## Settings Dialog

### Dashboard Page

The first page of Settings is a dashboard displaying large, colorful, informative stat banners:

- Time saved with moVoice (formatted as seconds / minutes / hours as appropriate).
- Number of sessions recorded.
- Number of words dictated.
- Words per minute (average transcription throughput).
- Keystrokes saved.

### General Settings Page

- **Global shortcut** — supports three modes:
  - Toggle mode (press once to start, press again to stop).
  - Push-to-talk mode (hold to record, release to stop).
  - Combined mode (both behaviours available simultaneously).
  - Comes with a set of predefined single-key shortcuts and a custom shortcut configurator.
- **Hide Dock icon** — toggle.
- **Launch at Login** — toggle.
- **Don't save transcripts** — toggle; when enabled, transcription text is not written to disk.
- **Don't save audio** — toggle; when enabled, recorded audio is not written to disk.

### Models Page

- Toggle to use **built-in macOS speech recognition** instead of a local model.
- List of supported Whisper (or compatible) models. Each model entry shows:
  - A descriptive label (one sentence).
  - Speed and accuracy indicators presented both visually and as a numeric X.X value.
  - A **Download** button; while downloading it shows progress inline.
  - When downloaded: **Delete** action.
  - A clear **"In Use"** visual marker on the active model.
- Selection logic:
  - If no models are downloaded, built-in macOS recognition is the active model.
  - If exactly one model is downloaded and built-in recognition is off, that model becomes active automatically.
  - One model (or built-in recognition) is always designated as active.
  - Model selection and download state are renderer-owned and are not exposed through the tray menu.

### Permissions Page

Displays all macOS permissions required by the application. Each permission entry shows:

- An icon.
- A one-sentence explanation of why the permission is needed.
- A colour-coded status indicator (e.g. granted / denied / not determined).
- For permissions not yet granted: an **"Open in System Settings"** button.
- A **Refresh** button to re-check the current status without restarting the app.

## History Dialog

Displays a chronological list of all transcription sessions. Selecting a session shows:

- The full transcription text when transcript saving was enabled for that session; otherwise a
  redacted transcript state.
- A compact audio player for the associated recording (visible but disabled when no audio was saved).
- Buttons to **Reveal audio file** and **Reveal transcript file** in Finder.
- A **Delete** button to remove the history entry (and its files, subject to the save-audio / save-transcript settings).

Each session entry includes metadata:

- Transcription engine used.
- Transcription duration (wall-clock time taken to process).
- Audio duration.
- Date and time of the session.
- Application into which the text was pasted.

## About Dialog

Displays:

- The moVoice application logo.
- Application version.
- Author name.
- "Powered by MōBrowser" attribution.

---

## Architecture

| Concern | Technology |
|---|---|
| Application shell & OS integration | MōBrowser |
| Audio capture | Renderer Web Audio API (`getUserMedia`, `AudioWorklet`) |
| Speech-to-text inference | Transformers.js v4 (local models) / macOS built-in speech recognition |
| UI framework | React (latest stable) |
| UI component library | shadcn/ui (latest stable) |
| Language | TypeScript (strict mode) |

MōBrowser provides the application skeleton: process management, tray integration, global shortcuts,
windowing, and OS-level APIs. The renderer process hosts the React UI and captures microphone audio
through the browser Web Audio API. All inter-process communication must follow MōBrowser's IPC
conventions (see `node_modules/@mobrowser/api/docs/guides/`).

## Generated Files

> **⛔ NEVER EDIT FILES IN `src/main/gen/`, `src/renderer/gen/`, OR `src/native/gen/`.**
>
> Every file in those directories begins with a `// Code generated … DO NOT EDIT.` header.
> Any hand-edit will be silently overwritten the next time `npm run gen` runs.
>
> **What to do instead:**
> 1. Edit the `.proto` source file (under `src/renderer/proto/` or `src/native/proto/`).
> 2. Run `nvm use 24 && npm run gen` to regenerate all three `gen/` trees.
> 3. Commit both the `.proto` change and the regenerated files together.
>
> This rule has no exceptions. If a generated type or service method is missing or wrong,
> the source of truth is the `.proto` definition — fix it there and regenerate.

## Documentation

**Classes:** The doc must answer two questions: what is this entity (its role), and what does it own or do (so a reader knows whether their concern belongs here). Always use a multi-line block comment. Do not describe internals, implementation details, or how the class is wired. Do not list what a class does not do unless something would genuinely be assumed otherwise. Do not mention the types of data handled if the name already implies them. Do not enumerate methods or operations — that duplicates what the method list already shows.

**Methods and fields:** State the outcome or meaning in one sentence. Always use a multi-line block comment.

**@param / @returns:** Use only when the name and type together do not fully convey the meaning — for example, a non-obvious constraint, a special sentinel value, or a parameter whose role is ambiguous in context. Never add them to restate what the signature already says.

**General:** Use plain ASCII punctuation only. No em dashes, arrows, or other non-default keyboard symbols. Add "why" or "how" commentary only when the logic is non-obvious from the code itself. Never reference temporary or external documents.

## Code Quality

- **Static analysis:** ESLint (TypeScript), Stylelint (CSS), and clang-tidy (C++) must be configured and enforced in CI.
- **Zero-warning policy:** all linters run in `--max-warnings 0` / `WarningsAsErrors: "*"` mode. No new warnings or errors may be introduced.
- **Separation of concerns** is the top architectural priority. Business logic, IPC layer, and UI components must be kept in clearly distinct modules.
- Code must follow established TypeScript and CSS best practices throughout (immutability by default, explicit types, no implicit `any`, consistent naming conventions, etc.).

### Lint suppression policy (TypeScript / CSS / C++)

Suppressing a linter diagnostic — via `eslint-disable`, `stylelint-disable`, a clang-tidy `NOLINT`/`NOLINTNEXTLINE` comment, or any equivalent mechanism — is **prohibited without explicit user confirmation**. Before adding any suppression you must:

1. **Ask the user** and explain why the suppression is necessary.
2. **Wait for approval.**
3. Immediately above the suppression, add a mandatory code comment in the following form:

   ```ts
   // lint-suppress: <rule-name>
   // Reason: <one sentence explaining why this suppression is justified>.
   // Approved by: user, <YYYY-MM-DD>.
   ```

   (Use the language-appropriate comment syntax: `//` for TypeScript/C++, `/* */` for CSS.)

Suppressions added without a matching comment and user approval must be treated as bugs and removed.
