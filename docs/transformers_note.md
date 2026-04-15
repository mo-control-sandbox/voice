# Transformers.js v4 — Architectural Note

## What Transformers.js v4 Does For Us

**Core capability:** Runs Whisper models (and other HuggingFace models) entirely in-process, in TypeScript, with no Python runtime, no server, no external API call.

**The pipeline API** is the entry point — one call initializes the model, one call transcribes:

```typescript
const transcriber = await pipeline("automatic-speech-recognition", "Xenova/whisper-small.en");
const result = await transcriber(audioFloat32Array);
// → { text: "transcribed text here" }
```

**Specifically it handles:**
- Model download from HuggingFace Hub, with progress callbacks you can wire to the UI
- Model caching after first download (ONNX format, persisted to disk)
- ONNX runtime execution — the heavy math
- Whisper-specific tokenization, mel spectrogram generation, beam search decoding
- WebGPU acceleration (`{ device: "webgpu" }`) for GPU offload
- Multi-language transcription and language auto-detection
- Timestamps in output
- Running in a Worker thread (recommended pattern to keep main thread unblocked)

---

## What It Does NOT Do For Us

**1. Audio capture — not its concern.**
It never touches the microphone. That's MōBrowser's domain. Transformers.js only sees a `Float32Array` you hand it.

**2. Audio format conversion — your responsibility.**
Whisper has hard requirements: `Float32Array`, mono channel, **16,000 Hz sample rate**. Whatever MōBrowser gives you from the mic (likely a different sample rate, possibly multi-channel, possibly interleaved PCM) must be converted before you call the pipeline. This is a non-trivial preprocessing step you own.

**3. Real-time / streaming transcription — not supported.**
It operates on a complete, finished audio buffer. The flow is: record → stop → hand buffer → get text. There is no "feed chunks while recording" path. This aligns with the spec (shortcut stops → then transcribes), but it means the user waits after stopping.

**4. Model storage location control — fully configurable.**
Three `env` properties control storage, and must be set before any `pipeline()` call:

```typescript
import { env } from "@huggingface/transformers";

// Where downloaded models are persisted on disk
env.cacheDir = "/Users/.../Library/Application Support/moVoice/models";

// Alternative: load from a fully local directory (e.g. bundled with app)
env.localModelPath = "/path/to/bundled/models/";

// Disable Hub network access entirely (offline mode)
env.allowRemoteModels = false;
```

Set `env.cacheDir` to the MōBrowser equivalent of `app.getPath('userData') + '/models'` at app initialization. This gives a deterministic, OS-appropriate, user-writable path — and makes "Reveal in Finder" trivial since the location is always known.

**5. Model lifecycle management — your concern.**
Downloading, deleting, switching between models, knowing which is active — none of that is in the library. You build it on top of the download progress callback it provides.

**6. Paste / clipboard / window focus — obviously out of scope.**
Those are MōBrowser OS-integration concerns.

---

## The Architectural Seam

The MōBrowser renderer process runs in a **full Chromium sandbox** with no Node.js, no `fs`, and no OS APIs. `env.cacheDir` relies on Node.js `fs` — it will not work from the renderer. Transformers.js would silently fall back to IndexedDB/Cache API storage, losing all path control. Web Workers inside the renderer are Chromium workers and share the same restriction.

**Transformers.js must therefore run in the main process**, which has full Node.js access.

```
Renderer Process (React UI)
  │
  │  IPC → "transcribe" (passes audio buffer)
  │  IPC → "downloadModel" / "deleteModel" / "listModels"
  │  IPC ← progress events, transcription result, errors
  │
Main Process
  ├── TranscriptionService  ← Transformers.js + env.cacheDir set here
  └── ModelManager          ← download, delete, list; exposes known cache path
```

The renderer sends commands and receives events only — it never touches model files directly. The main process owns all model I/O and all Transformers.js lifecycle.

`TranscriptionService` should be behind a simple interface so the macOS built-in recognition backend is a drop-in swap:

```typescript
interface TranscriptionService {
  transcribe(audio: Float32Array): Promise<string>;
}
```
