import type { JSX } from 'react';
import { cn } from '@/lib/utils';

interface WaveformVisualizerProps {
  /** Normalised microphone amplitude in [0, 1]. */
  amplitude: number
}

/** Number of bars in the waveform display. */
const BAR_COUNT = 5;

/** Minimum bar height as a fraction of the container. */
const MIN_HEIGHT_FRACTION = 0.15;

/**
 * Renders an animated bar waveform that reacts to the microphone amplitude.
 * Each bar oscillates at its own phase; amplitude scales the overall height.
 */
export function WaveformVisualizer({ amplitude }: WaveformVisualizerProps): JSX.Element {
  return (
    <div className="flex items-center justify-center gap-1 h-10">
      {Array.from({ length: BAR_COUNT }, (_, i) => {
        const phase = (i / BAR_COUNT) * Math.PI;
        const scale = MIN_HEIGHT_FRACTION + (1 - MIN_HEIGHT_FRACTION) * amplitude;
        const delay = `${-(phase / Math.PI) * 0.6}s`;
        const duration = `${0.5 + (i % 3) * 0.1}s`;
        return (
          <div
            key={i}
            className={cn(
              'w-1 rounded-full bg-primary transition-none',
              amplitude > 0.01 ? 'animate-[wavebar_ease-in-out_infinite_alternate]' : '',
            )}
            style={{
              height: `${Math.round(scale * 100)}%`,
              animationDuration: duration,
              animationDelay: delay,
            }}
          />
        );
      })}
    </div>
  );
}
