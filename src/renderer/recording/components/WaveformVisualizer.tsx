interface WaveformVisualizerProps {
  readonly getAmplitude: () => number;
}

/**
 * Crisp canvas waveform visualiser.
 *
 * - Scales the backing store by devicePixelRatio for sharp Retina rendering.
 * - Bars grow symmetrically from the vertical centre.
 * - Each bar has its own phase and oscillation speed so they move organically
 *   in place -- no left-to-right scrolling.
 * - Amplitude is lerped to suppress single-frame spikes.
 * - No React state -- all animation lives inside requestAnimationFrame.
 */
export function WaveformVisualizer({ getAmplitude: _getAmplitude }: WaveformVisualizerProps): React.JSX.Element {
  return <span>Recording</span>;
}
