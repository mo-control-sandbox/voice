import { useEffect, useRef, useState } from 'react';
import type { ModelDefinition } from '../types/models';
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

// Singletons shared for the lifetime of the recording window.
const catalog = new RendererModelCatalog();
const whisperDefs = catalog.getDefinitions().filter(
  (d): d is ModelDefinition => !d.isBuiltin,
);
const modelRepository = new RendererModelRepository(
  catalog,
  new RendererModelCache(whisperDefs),
  new RendererModelStateStore(),
);
const controller = new RecordingController(modelRepository, new MoVoiceBackendFactory());

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Presentation root for the recording window.
 *
 * Subscribes to RecordingController and maps its state to the appropriate
 * view: nothing while idle, waveform + elapsed time while recording, and
 * a processing indicator while transcription is running.
 */
export function RecordingApp(): React.JSX.Element {
  const [viewState, setViewState] = useState<RecordingViewState>({
    phase: 'idle',
    isAudioReady: false,
  });
  const [elapsed, setElapsed] = useState(0);
  const controllerRef = useRef(controller);

  useEffect(() => {
    return controllerRef.current.start(setViewState);
  }, []);

  // Elapsed-time ticker -- increments while recording, resets otherwise.
  useEffect(() => {
    if (viewState.phase !== 'recording') {
      setElapsed(0);
      return;
    }
    const id = setInterval(() => { setElapsed(s => s + 1); }, 1000);
    return () => { clearInterval(id); };
  }, [viewState.phase]);

  const { phase, isAudioReady } = viewState;

  if (phase === 'idle') {
    return <></>;
  }

  return (
    <div>
      {phase === 'recording' && (
        <div>
          {isAudioReady && (
            <WaveformVisualizer getAmplitude={() => controllerRef.current.getAmplitude()} />
          )}
          <span>{formatElapsed(elapsed)}</span>
        </div>
      )}
      {phase === 'processing' && <ProcessingIndicator />}
      <CancelButton onCancel={() => { controllerRef.current.cancel(); }} />
    </div>
  );
}
