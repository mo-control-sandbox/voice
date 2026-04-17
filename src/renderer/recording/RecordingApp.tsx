import { useEffect, useRef, useState } from 'react';
import type { RecordingSignalSnapshotProto } from '../gen/main_signal';
import { ipc } from '../gen/ipc';
import type { ModelDefinition } from '../types/models';
import { AudioPipeline } from './audio/AudioPipeline';
import type { PcmAudio } from './audio/PcmAudio';
import { WaveformVisualizer } from './components/WaveformVisualizer';
import { ProcessingIndicator } from './components/ProcessingIndicator';
import { CancelButton } from './components/CancelButton';
import { RendererModelCatalog } from '../services/RendererModelCatalog';
import { RendererModelCache } from '../services/RendererModelCache';
import { RendererModelStateStore } from '../services/RendererModelStateStore';
import { RendererModelRepository } from '../services/RendererModelRepository';
import { MoVoiceBackendFactory } from './services/MoVoiceBackendFactory';
import { TranscriptionOrchestrator } from './services/TranscriptionOrchestrator';
import { reverseIpcBridge } from '../ipc/ReverseIpcBridge';
import { RecordingSignalService } from '../ipc/SignalService';

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
const backendFactory = new MoVoiceBackendFactory();

/**
 * Central coordinator for the recording window.
 *
 * Registers a RecordingSignalService with MainSignalBus and reacts to state
 * transitions delivered by the bus:
 * - idle → recording: starts the AudioPipeline.
 * - recording → processing: stops the pipeline, runs inference, submits result.
 * - → idle: tears down any remaining pipeline state.
 */
export function RecordingApp(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<RecordingSignalSnapshotProto | null>(null);
  const [activePipeline, setActivePipeline] = useState<AudioPipeline | null>(null);
  const pipelineRef = useRef<AudioPipeline | null>(null);
  const lastSessionIdRef = useRef<string>('');
  const lastStateRef = useRef<string>('idle');
  // AbortController for the active inference run so CancelRecording can stop it.
  const inferenceAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;

    const unregister = reverseIpcBridge.registerService(
      RecordingSignalService({
        async onRecordingChanged(next) {
          if (!mounted) return;

          const prevSessionId = lastSessionIdRef.current;
          const prevState = lastStateRef.current;

          setSnapshot(next);

          const sessionChanged = next.sessionId !== '' && next.sessionId !== prevSessionId;
          const stateChanged = next.state !== prevState;

          // Update refs BEFORE any await so concurrent ticks don't re-trigger
          // the same transition while an async operation is in flight.
          lastSessionIdRef.current = next.sessionId;
          lastStateRef.current = next.state;

          if (sessionChanged || (stateChanged && next.state === 'recording')) {
            const settings = await ipc.settings.GetSettings({});
            await startAudio(next.sessionId, settings.audioInputDeviceId);
          } else if (stateChanged && next.state === 'processing') {
            await stopAudioAndProcess(next.sessionId, next.dontSaveAudio);
          } else if (stateChanged && next.state === 'idle') {
            void cleanup();
          }
        },
      }),
    );

    return () => {
      mounted = false;
      unregister();
      inferenceAbortRef.current?.abort();
      void cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startAudio(sessionId: string, deviceId: string): Promise<void> {
    await cleanup();
    const pipeline = new AudioPipeline();
    pipelineRef.current = pipeline;

    pipeline.onTrackEnded(() => {
      void ipc.recording.CancelRecording({ sessionId, reason: 'DEVICE_DISCONNECTED' });
    });

    try {
      await pipeline.start(deviceId);
      if (pipelineRef.current !== pipeline) {
        await pipeline.release();
        return;
      }
      setActivePipeline(pipeline);
    } catch (err) {
      console.error('[RecordingApp] Failed to start audio:', err);
      pipelineRef.current = null;
      await pipeline.release();
      await ipc.recording.CancelRecording({ sessionId, reason: 'AUDIO_START_FAILED' });
    }
  }

  async function stopAudioAndProcess(sessionId: string, dontSaveAudio: boolean): Promise<void> {
    const pipeline = pipelineRef.current;
    pipelineRef.current = null;
    setActivePipeline(null);

    // Get resampled PCM before closing the context.
    let audio: PcmAudio;
    if (pipeline !== null) {
      audio = await pipeline.stop();
    } else {
      audio = { samples: new Float32Array(0), sampleRate: 16000, channelCount: 1 };
    }

    const inferenceStartMs = Date.now();

    const activeModel = await modelRepository.getActiveModel();

    const language = activeModel.definition.isBuiltin
      ? null
      : (activeModel.definition.isMultilingual ? modelRepository.getLanguage() : null);

    const backend = backendFactory.createBackend(activeModel.definition);

    const abortController = new AbortController();
    inferenceAbortRef.current = abortController;

    const orchestrator = new TranscriptionOrchestrator(backend);
    const result = await orchestrator.transcribe(
      audio,
      language === 'auto' ? null : (language ?? null),
      abortController.signal,
    );
    inferenceAbortRef.current = null;

    const transcriptionDurationMs = Date.now() - inferenceStartMs;
    const audioDurationSeconds = audio.samples.length / audio.sampleRate;

    if (result !== null) {
      const engineLabel = activeModel.definition.isBuiltin
        ? 'Built-in'
        : activeModel.definition.label;

      const pcmBytes = dontSaveAudio
        ? new Uint8Array(0)
        : new Uint8Array(audio.samples.buffer, audio.samples.byteOffset, audio.samples.byteLength);

      await ipc.recording.SubmitTranscription({
        sessionId,
        text: result.text,
        detectedLanguage: result.detectedLanguage,
        audioDurationSeconds,
        transcriptionDurationMs,
        transcriptionEngineLabel: engineLabel,
        pcm: pcmBytes,
      });
    } else {
      await ipc.recording.CancelRecording({ sessionId, reason: 'CANCELLED' });
    }
  }

  async function cleanup(): Promise<void> {
    const pipeline = pipelineRef.current;
    if (pipeline !== null) {
      pipelineRef.current = null;
      setActivePipeline(null);
      await pipeline.release();
    }
  }

  const state = snapshot?.state ?? 'idle';
  const sessionId = snapshot?.sessionId ?? '';

  if (state === 'idle') {
    return <div className="hidden" />;
  }

  return (
    <div
      className="flex h-screen items-center justify-between gap-4 bg-background/90 backdrop-blur-sm px-4 rounded-xl border border-border shadow-lg"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {state === 'recording' && activePipeline !== null && (
        <WaveformVisualizer pipeline={activePipeline} />
      )}
      {state === 'processing' && (
        <ProcessingIndicator />
      )}
      <CancelButton sessionId={sessionId} pipeline={activePipeline} />
    </div>
  );
}
