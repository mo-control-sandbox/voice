import { useEffect, useRef } from 'react';
import type { AudioPipeline } from '../audio/AudioPipeline';

interface WaveformVisualizerProps {
  readonly pipeline: AudioPipeline;
}

const BAR_COUNT = 20;
const BAR_MIN_HEIGHT = 4;
const BAR_MAX_HEIGHT = 36;
const BAR_COLOR = '#3b82f6'; // blue-500

/**
 * Canvas-based waveform animation driven by AudioPipeline.getAmplitude().
 * Reads amplitude directly from the pipeline — no IPC or state involved.
 */
export function WaveformVisualizer({ pipeline }: WaveformVisualizerProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const barsRef = useRef<number[]>(new Array<number>(BAR_COUNT).fill(BAR_MIN_HEIGHT));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;

    function draw(): void {
      if (canvas === null || ctx === null) return;

      const amplitude = pipeline.getAmplitude();
      const bars = barsRef.current;

      // Shift bars left and append new bar driven by current amplitude.
      bars.shift();
      const newHeight = BAR_MIN_HEIGHT + amplitude * (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT);
      bars.push(newHeight);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = canvas.width / BAR_COUNT;
      const centerY = canvas.height / 2;

      ctx.fillStyle = BAR_COLOR;
      for (let i = 0; i < bars.length; i++) {
        const h = bars[i];
        ctx.beginPath();
        ctx.roundRect(
          i * barWidth + 2,
          centerY - h / 2,
          barWidth - 4,
          h,
          2,
        );
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); };
  }, [pipeline]);

  return (
    <canvas
      ref={canvasRef}
      width={240}
      height={48}
      className="block"
    />
  );
}
