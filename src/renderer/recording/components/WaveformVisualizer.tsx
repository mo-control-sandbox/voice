import { useEffect, useRef } from 'react';
import './WaveformVisualizer.css';

interface WaveformVisualizerProps {
  readonly getAmplitude: () => number;
}

// ── Layout constants (CSS-pixel space) ────────────────────────────────────────

const BAR_COUNT      = 30;
const BAR_WIDTH      = 3;    // px
const BAR_GAP        = 3;    // px
const BAR_MIN_HEIGHT = 2;    // px
const BAR_MAX_HEIGHT = 26;   // px
const CANVAS_CSS_W   = (BAR_WIDTH + BAR_GAP) * BAR_COUNT - BAR_GAP; // 177px
const CANVAS_CSS_H   = 32;   // px

// ── Per-bar variation ─────────────────────────────────────────────────────────
// Each bar oscillates at a slightly different speed and phase so they move
// independently rather than all pulsing in lock-step.

const BAR_SPEEDS = Array.from(
  { length: BAR_COUNT },
  () => 1.2 + Math.random() * 1.6,   // oscillation speed (radians/second)
);
const BAR_PHASES = Array.from(
  { length: BAR_COUNT },
  () => Math.random() * Math.PI * 2, // random start phase
);

// ── Animation constants ───────────────────────────────────────────────────────

/** Amplitude lerp — controls how quickly bars react to volume changes. */
const AMPLITUDE_LERP = 0.15;

/**
 * Crisp canvas waveform visualiser.
 *
 * - Scales the backing store by devicePixelRatio for sharp Retina rendering.
 * - Bars grow symmetrically from the vertical centre.
 * - Each bar has its own phase and oscillation speed so they move organically
 *   in place — no left-to-right scrolling.
 * - Amplitude is lerped to suppress single-frame spikes.
 * - No React state — all animation lives inside requestAnimationFrame.
 */
export function WaveformVisualizer({ getAmplitude }: WaveformVisualizerProps): React.JSX.Element {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const rafRef      = useRef<number>(0);
  const smoothedRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    smoothedRef.current = 0;

    // Scale the backing store to the device pixel ratio for sharp rendering.
    const dpr = window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
    canvas.width  = Math.round(CANVAS_CSS_W * dpr);
    canvas.height = Math.round(CANVAS_CSS_H * dpr);

    const ctx = canvas.getContext('2d');
    if (ctx === null) return;
    ctx.scale(dpr, dpr);

    function draw(timestamp: DOMHighResTimeStamp): void {
      if (canvas === null || ctx === null) return;

      const t = timestamp / 1000; // seconds

      // Smooth raw amplitude.
      smoothedRef.current += AMPLITUDE_LERP * (getAmplitude() - smoothedRef.current);
      const amp = smoothedRef.current;

      ctx.clearRect(0, 0, CANVAS_CSS_W, CANVAS_CSS_H);

      const resolvedColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--foreground')
        .trim();
      ctx.fillStyle = resolvedColor !== '' ? resolvedColor : 'oklch(0.145 0 0)';
      ctx.globalAlpha = 0.85;

      const centerY = CANVAS_CSS_H / 2;
      const step    = BAR_WIDTH + BAR_GAP;

      for (let i = 0; i < BAR_COUNT; i++) {
        // Each bar's envelope is the global amplitude modulated by its own
        // sine wave, giving organic independent motion.
        const variation = 0.5 + 0.5 * Math.sin(t * BAR_SPEEDS[i] + BAR_PHASES[i]);
        const h = BAR_MIN_HEIGHT + amp * variation * (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT);

        const x     = i * step;
        const halfH = h / 2;

        ctx.beginPath();
        ctx.roundRect(x, centerY - halfH, BAR_WIDTH, h, BAR_WIDTH / 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="waveform-visualizer"
      aria-hidden="true"
    />
  );
}
