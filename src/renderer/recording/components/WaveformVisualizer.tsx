import { useEffect, useRef } from 'react';
import './WaveformVisualizer.css';

interface WaveformVisualizerProps {
  readonly getWaveformData: () => Float32Array;
}

const BAR_COUNT = 36;
const MIN_FRAC  = 0.06; // floor height when signal is silent
const LERP      = 0.18; // per-frame smoothing factor

/**
 * Bar waveform visualiser that mirrors the live microphone signal.
 *
 * Each frame, time-domain data is read from the AudioPipeline's AnalyserNode,
 * bucketed into BAR_COUNT equal slices, and the peak amplitude of each slice
 * drives one bar. Bars grow and shrink symmetrically from their centre via
 * scaleY; LERP smoothing prevents jitter without adding lag. When no audio
 * data is available the bars sit at MIN_FRAC height with no animation.
 */
export function WaveformVisualizer({ getWaveformData }: WaveformVisualizerProps): React.JSX.Element {
  const barsRef  = useRef<(HTMLDivElement | null)[]>([]);
  const getDataRef = useRef(getWaveformData);
  useEffect(() => { getDataRef.current = getWaveformData; }, [getWaveformData]);

  useEffect(() => {
    const smoothed = new Float32Array(BAR_COUNT).fill(MIN_FRAC);
    let raf = 0;

    function draw(): void {
      const data = getDataRef.current();

      for (let i = 0; i < BAR_COUNT; i++) {
        const bar = barsRef.current[i];
        if (bar === null) continue;

        let target = MIN_FRAC;
        if (data.length > 0) {
          const start = Math.floor(i * data.length / BAR_COUNT);
          const end   = Math.floor((i + 1) * data.length / BAR_COUNT);
          let peak = 0;
          for (let j = start; j < end; j++) {
            if (data[j] > peak) peak = data[j];
          }
          target = Math.max(MIN_FRAC, peak);
        }

        smoothed[i] += (target - smoothed[i]) * LERP;
        bar.style.transform = `scaleY(${smoothed[i].toFixed(3)})`;
      }

      raf = requestAnimationFrame(draw);
    }

    draw();
    return () => { cancelAnimationFrame(raf); };
  }, []);

  return (
    <div className="waveform-visualizer" aria-hidden="true">
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <div
          key={i}
          className="waveform-visualizer__bar"
          ref={(el) => { barsRef.current[i] = el; }}
        />
      ))}
    </div>
  );
}
