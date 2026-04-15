import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { ipc } from '@/gen/ipc';
import { RecordingState } from '@/gen/recording';
import { WaveformVisualizer } from './WaveformVisualizer';
import { ProcessingIndicator } from './ProcessingIndicator';
import { CancelButton } from './CancelButton';

/** Polling interval in milliseconds (~30 fps). */
const POLL_INTERVAL_MS = 33;

/** Target sample rate for the transcription model. */
const TARGET_SAMPLE_RATE = 16_000;

/** Amplitude smoothing factor (0 = no smoothing, 1 = no response). */
const AMPLITUDE_SMOOTHING = 0.25;

interface AudioSession {
  stream: MediaStream
  context: AudioContext
  analyser: AnalyserNode
  workletNode: AudioWorkletNode
  chunks: Float32Array[]
}

/**
 * Converts a Float32Array of PCM samples to a Uint8Array of raw little-endian
 * bytes (4 bytes per sample) for the SubmitAudio proto request.
 */
function float32ToBytes(samples: Float32Array<ArrayBufferLike>): Uint8Array {
  return new Uint8Array(samples.buffer as ArrayBuffer, samples.byteOffset, samples.byteLength);
}

/**
 * Concatenates accumulated PCM chunks into a single Float32Array.
 */
function mergeChunks(chunks: Float32Array[]): Float32Array {
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

/**
 * Resamples a Float32Array from the source sample rate to 16 kHz mono using
 * an OfflineAudioContext.
 */
async function resampleTo16kHz(
  samples: Float32Array<ArrayBufferLike>,
  sourceSampleRate: number,
): Promise<Float32Array<ArrayBuffer>> {
  const duration = samples.length / sourceSampleRate;
  const targetLength = Math.ceil(duration * TARGET_SAMPLE_RATE);
  const offline = new OfflineAudioContext(1, targetLength, TARGET_SAMPLE_RATE);

  const buffer = offline.createBuffer(1, samples.length, sourceSampleRate);
  buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);

  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();

  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

/**
 * Recording window root component.
 *
 * Polls RecordingService.GetStatus() at ~30 fps and manages the Web Audio
 * pipeline (getUserMedia → AudioWorklet → AnalyserNode) in sync with the
 * main-process FSM state.
 */
export function RecordingApp(): JSX.Element {
  const [recordingState, setRecordingState] = useState<RecordingState>(RecordingState.IDLE);
  const [amplitude, setAmplitude] = useState(0);

  // Stable refs so the polling closure always sees fresh values without
  // causing the effect to re-run.
  const stateRef = useRef<RecordingState>(RecordingState.IDLE);
  const audioRef = useRef<AudioSession | null>(null);
  const analyserDataRef = useRef<Float32Array<ArrayBuffer> | null>(null);

  const startAudio = async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const context = new AudioContext();
      await context.audioWorklet.addModule('/audio-processor.js');

      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyserDataRef.current = new Float32Array(analyser.fftSize);

      const workletNode = new AudioWorkletNode(context, 'pcm-accumulator');
      const chunks: Float32Array[] = [];

      workletNode.port.onmessage = (e: MessageEvent<Float32Array>): void => {
        chunks.push(e.data);
      };

      source.connect(analyser);
      source.connect(workletNode);

      audioRef.current = { stream, context, analyser, workletNode, chunks };
    } catch (err) {
      console.error('[RecordingApp] Failed to start audio:', err);
    }
  };

  const stopAudioAndSubmit = async (): Promise<void> => {
    const session = audioRef.current;
    if (session === null) return;

    // Stop microphone tracks immediately.
    for (const track of session.stream.getTracks()) {
      track.stop();
    }
    audioRef.current = null;
    analyserDataRef.current = null;

    const sourceSampleRate = session.context.sampleRate;
    await session.context.close();

    if (session.chunks.length === 0) return;

    const merged = mergeChunks(session.chunks);
    const resampled = await resampleTo16kHz(merged, sourceSampleRate);
    const pcm = float32ToBytes(resampled);

    await ipc.recording.SubmitAudio({ pcm });
  };

  const stopAudioAndDiscard = (): void => {
    const session = audioRef.current;
    if (session === null) return;
    for (const track of session.stream.getTracks()) {
      track.stop();
    }
    void session.context.close();
    audioRef.current = null;
    analyserDataRef.current = null;
    setAmplitude(0);
  };

  useEffect(() => {
    let cancelled = false;

    const tick = async (): Promise<void> => {
      if (cancelled) return;
      try {
        const response = await ipc.recording.GetStatus({});
        if (cancelled) return;

        const prev = stateRef.current;
        const next = response.state;

        if (prev !== next) {
          stateRef.current = next;
          setRecordingState(next);

          if (next === RecordingState.RECORDING) {
            await startAudio();
          } else if (next === RecordingState.PROCESSING) {
            await stopAudioAndSubmit();
          } else {
            // idle — discard any in-flight audio (e.g. cancel path)
            stopAudioAndDiscard();
          }
        }

        // Update amplitude from the analyser while recording.
        if (next === RecordingState.RECORDING && audioRef.current !== null) {
          const data = analyserDataRef.current;
          const { analyser } = audioRef.current;
          if (data !== null) {
            analyser.getFloatTimeDomainData(data);
            let peak = 0;
            for (let i = 0; i < data.length; i++) {
              const abs = Math.abs(data[i]);
              if (abs > peak) peak = abs;
            }
            // Smooth towards the new peak value.
            setAmplitude((prev) => prev * AMPLITUDE_SMOOTHING + peak * (1 - AMPLITUDE_SMOOTHING));
          }
        }
      } catch (err) {
        console.error('[RecordingApp] Poll error:', err);
      }
    };

    const id = setInterval(() => { void tick(); }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
      stopAudioAndDiscard();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = (): void => {
    stopAudioAndDiscard();
    setRecordingState(RecordingState.IDLE);
    stateRef.current = RecordingState.IDLE;
  };

  return (
    <div className="flex items-center justify-between px-4 h-full bg-background rounded-xl shadow-lg show-animation">
      <div className="flex-1 flex items-center justify-center">
        {recordingState === RecordingState.RECORDING && (
          <WaveformVisualizer amplitude={amplitude} />
        )}
        {recordingState === RecordingState.PROCESSING && (
          <ProcessingIndicator />
        )}
      </div>
      <CancelButton onCancel={handleCancel} />
    </div>
  );
}
