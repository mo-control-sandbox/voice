import { useEffect, useRef, useState } from 'react';

/**
 * Opens a microphone stream for the given device and continuously measures
 * the RMS audio level. Cleans up and restarts whenever the deviceId changes.
 */
export function useMicLevel(deviceId: string, enabled: boolean): {
  readonly level: number;
  readonly error: string | null;
} {
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) {
      setLevel(0);
      setError(null);
      return;
    }

    let active = true;
    let audioContext: AudioContext | null = null;
    let capturedStream: MediaStream | null = null;

    async function start(): Promise<void> {
      try {
        capturedStream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: deviceId } },
          video: false,
        });
        if (!active) {
          capturedStream.getTracks().forEach((t) => { t.stop(); });
          return;
        }

        audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        audioContext.createMediaStreamSource(capturedStream).connect(analyser);
        setError(null);

        const data = new Uint8Array(analyser.frequencyBinCount);

        function tick(): void {
          if (!active) return;
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (const sample of data) {
            const normalized = (sample - 128) / 128;
            sum += normalized * normalized;
          }
          setLevel(Math.sqrt(sum / data.length));
          rafRef.current = requestAnimationFrame(tick);
        }

        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : String(err));
        setLevel(0);
      }
    }

    void start();

    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
      capturedStream?.getTracks().forEach((t) => { t.stop(); });
      void audioContext?.close();
    };
  }, [deviceId, enabled]);

  return { level, error };
}
