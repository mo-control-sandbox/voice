import { useEffect, useRef, useState } from 'react';
import { WaveformVisualizer } from './components/WaveformVisualizer';
import { ProcessingIndicator } from './components/ProcessingIndicator';
import { CancelButton } from './components/CancelButton';
import { RendererModelCatalog } from '../services/RendererModelCatalog';
import { RendererModelCache } from '../services/RendererModelCache';
import { RendererModelStateStore } from '../services/RendererModelStateStore';
import { RendererModelRepository } from '../services/RendererModelRepository';
import { MoVoiceBackendFactory } from './services/MoVoiceBackendFactory';
import { RecordingController } from './RecordingController';
import type { RecordingViewState } from './RecordingController';
import './RecordingApp.css';

// Singletons shared for the lifetime of the recording window.
const catalog = new RendererModelCatalog();
const modelRepository = new RendererModelRepository(
  catalog,
  new RendererModelCache(catalog.getDefinitions()),
  new RendererModelStateStore(),
);
const controller = new RecordingController(modelRepository, new MoVoiceBackendFactory());

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m)}:${String(s).padStart(2, '0')}`;
}

/**
 * Presentation root for the recording window.
 *
 * Subscribes to RecordingController and maps its state to the recording HUD:
 * nothing while idle, waveform while recording, processing indicator while
 * transcription is running. Both state layers are always mounted so the CSS
 * cross-fade transition has elements to animate between.
 */
export function RecordingApp(): React.JSX.Element {
  const [viewState, setViewState] = useState<RecordingViewState>({
    phase: 'idle',
    isAudioReady: false,
    errorMessage: null,
  });
  const [elapsed, setElapsed] = useState(0);
  const controllerRef = useRef(controller);

  useEffect(() => {
    return controllerRef.current.start(setViewState);
  }, []);

  // Elapsed-time ticker -- increments every second while recording, resets otherwise.
  useEffect(() => {
    if (viewState.phase !== 'recording') {
      setElapsed(0);
      return;
    }
    const id = setInterval(() => { setElapsed(s => s + 1); }, 1000);
    return () => { clearInterval(id); };
  }, [viewState.phase]);

  const { phase, isAudioReady, errorMessage } = viewState;

  if (phase === 'idle') {
    return <></>;
  }

  return (
    <div className="recording-window" data-state={phase}>
      {/* Screen-reader live region announces state transitions. */}
      <span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="recording-window__announcer"
      >
        {phase === 'recording' ? 'Recording' : phase === 'error' ? errorMessage : 'Transcribing'}
      </span>

      <div className="recording-window__dot" />

      <div className="recording-window__body">
        {/* Recording layer: waveform + elapsed time. */}
        <div className="recording-window__content" data-role="recording">
          <div className="recording-window__waveform-slot">
            {/* Render immediately -- bars breathe at minimum height until
                the audio pipeline is ready, then react to real amplitude. */}
            <WaveformVisualizer
              getWaveformData={() => isAudioReady ? controllerRef.current.getWaveformData() : new Float32Array(0)}
            />
          </div>
          <span className="recording-window__elapsed">{formatElapsed(elapsed)}</span>
        </div>

        {/* Processing layer: three-dot bounce + label. */}
        <div className="recording-window__content" data-role="processing">
          <ProcessingIndicator />
          <span className="recording-window__processing-label">Transcribing</span>
        </div>

        {/* Error layer: message text. Auto-dismissed by RecordingController. */}
        <div className="recording-window__content" data-role="error">
          <span className="recording-window__error-message">{errorMessage ?? ''}</span>
        </div>
      </div>

      <CancelButton onCancel={() => { controllerRef.current.cancel(); }} />
    </div>
  );
}
