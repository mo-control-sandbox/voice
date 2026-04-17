import type { PcmAudio } from './PcmAudio';

/**
 * AudioPipeline manages microphone capture and PCM accumulation for a single
 * recording session.
 *
 * Responsibilities:
 * - Acquires the configured microphone (or the system default) via getUserMedia.
 * - Accumulates raw Float32 PCM chunks via AudioWorkletNode.
 * - Drives real-time waveform display via AnalyserNode (no IPC needed).
 * - On stop(), resamples accumulated PCM to 16 kHz mono via OfflineAudioContext.
 * - Notifies the caller when the MediaStreamTrack ends unexpectedly (§4.10).
 */
export class AudioPipeline {
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private pcmChunks: Float32Array[] = [];
  private trackEndedCallback: (() => void) | null = null;
  private workletNode: AudioWorkletNode | null = null;

  /**
   * Starts microphone capture.
   *
   * @param deviceId - MediaDevices deviceId for the audio input.
   *   Pass an empty string (or omit) to use the system default.
   *
   * Builds AudioContext → AudioWorkletNode (PCM accumulation) + AnalyserNode (waveform).
   */
  async start(deviceId = ''): Promise<void> {
    this.pcmChunks = [];
    const audioConstraint: MediaTrackConstraints = deviceId !== ''
      ? { deviceId: { exact: deviceId } }
      : {};
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraint, video: false });

    this.audioContext = new AudioContext();
    await this.audioContext.audioWorklet.addModule(
      new URL('./AudioWorkletProcessor.js', import.meta.url),
    );

    const source = this.audioContext.createMediaStreamSource(this.stream);

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);

    this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-collector');
    this.workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
      this.pcmChunks.push(event.data);
    };
    source.connect(this.workletNode);
    // Chrome only delivers real mic samples to nodes with an active path to
    // the destination. Connect through a muted gain node to satisfy that
    // requirement without playing any audio.
    const silencer = this.audioContext.createGain();
    silencer.gain.value = 0;
    this.workletNode.connect(silencer);
    silencer.connect(this.audioContext.destination);

    // Detect unexpected device disconnection (§4.10).
    for (const track of this.stream.getAudioTracks()) {
      track.onended = () => { this.trackEndedCallback?.(); };
    }
  }

  /**
   * Returns a normalised amplitude value in [0, 1] suitable for the waveform
   * visualiser. Reads from AnalyserNode — no IPC involved.
   */
  getAmplitude(): number {
    if (this.analyser === null) return 0;
    const buffer = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(buffer);
    let peak = 0;
    for (const sample of buffer) {
      // byteTimeDomainData is centred at 128; deviation from 128 is the signal.
      peak = Math.max(peak, Math.abs(sample - 128));
    }
    return peak / 128;
  }

  /**
   * Immediately releases the microphone and closes the AudioContext without
   * resampling. Use this on all cancel / cleanup paths where PCM is not needed.
   *
   * On macOS/Chromium the OS mic indicator does not clear until the AudioContext
   * close promise resolves — this method awaits that promise before returning.
   */
  async release(): Promise<void> {
    this.trackEndedCallback = null;
    this.stream?.getAudioTracks().forEach((t) => { t.stop(); });
    this.stream = null;
    this.workletNode?.disconnect();
    this.workletNode?.port.close();
    this.workletNode = null;
    this.analyser = null;
    this.pcmChunks = [];
    const ctx = this.audioContext;
    this.audioContext = null;
    await ctx?.close();
  }

  /**
   * Stops all tracks, disconnects the worklet, resamples the accumulated PCM to
   * 16 kHz mono, and returns a PcmAudio with explicit format metadata.
   * Use this only when the PCM data is actually needed (Phase 4 inference path).
   */
  async stop(): Promise<PcmAudio> {
    this.stream?.getAudioTracks().forEach((t) => { t.stop(); });
    this.stream = null;
    this.workletNode?.disconnect();
    this.workletNode?.port.close();
    this.workletNode = null;
    this.analyser = null;

    const sampleRate = this.audioContext?.sampleRate ?? 44100;
    const allChunks = this.mergeChunks();

    await this.audioContext?.close();
    this.audioContext = null;

    const samples = await this.resampleTo16kHz(allChunks, sampleRate);
    return { samples, sampleRate: 16000, channelCount: 1 };
  }

  /**
   * Registers a callback that fires if the MediaStreamTrack ends unexpectedly
   * (e.g. the microphone is unplugged). The caller should treat this as a
   * cancellation.
   */
  onTrackEnded(cb: () => void): void {
    this.trackEndedCallback = cb;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private mergeChunks(): Float32Array {
    const total = this.pcmChunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Float32Array(total);
    let offset = 0;
    for (const chunk of this.pcmChunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    this.pcmChunks = [];
    return merged;
  }

  private async resampleTo16kHz(
    input: Float32Array,
    inputSampleRate: number,
  ): Promise<Float32Array> {
    if (input.length === 0) return new Float32Array(0);

    const targetSampleRate = 16000;
    const outputLength = Math.ceil((input.length * targetSampleRate) / inputSampleRate);

    const offlineCtx = new OfflineAudioContext(1, outputLength, targetSampleRate);
    const buffer = offlineCtx.createBuffer(1, input.length, inputSampleRate);
    // Copy via a fresh ArrayBuffer-backed Float32Array to satisfy strict typing.
    buffer.copyToChannel(new Float32Array(input), 0);

    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    const rendered = await offlineCtx.startRendering();
    return rendered.getChannelData(0);
  }
}
