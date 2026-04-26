import type { PcmAudio } from './PcmAudio';

/**
 * AudioPipeline manages microphone capture and PCM accumulation for a single
 * recording session.
 *
 * Responsibilities:
 * - Acquires the configured microphone (or the system default) via getUserMedia.
 * - Accumulates raw Float32 PCM chunks via AudioWorkletNode.
 * - Drives real-time waveform display via AnalyserNode (no IPC needed).
 * - Fires an optional per-chunk callback for streaming transcription consumers.
 * - On stop(), resamples accumulated PCM to 16 kHz mono via OfflineAudioContext.
 * - Notifies the caller when the MediaStreamTrack ends unexpectedly.
 */
export class AudioPipeline {
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private pcmChunks: Float32Array[] = [];
  private trackEndedCallback: (() => void) | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private chunkCallback: ((samples: Float32Array) => void) | null = null;

  /**
   * Starts microphone capture.
   *
   * @param deviceId - MediaDevices deviceId for the audio input.
   *   Pass an empty string (or omit) to use the system default.
   * @param sampleRate - AudioContext sample rate. Pass 16000 for streaming
   *   backends so the OS resamples before chunks reach the worklet; omit to
   *   use the device native rate (batch path resamples via OfflineAudioContext).
   */
  async start(deviceId = '', sampleRate?: number): Promise<void> {
    this.pcmChunks = [];
    const audioConstraint: MediaTrackConstraints = deviceId !== ''
      ? { deviceId: { exact: deviceId } }
      : {};
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraint, video: false });

    const contextOptions = sampleRate !== undefined ? { sampleRate } : undefined;
    this.audioContext = new AudioContext(contextOptions);
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
      this.chunkCallback?.(event.data);
    };
    source.connect(this.workletNode);
    // MōBrowser only delivers real mic samples to nodes with an active path to
    // the destination. Connect through a muted gain node to satisfy that
    // requirement without playing any audio.
    const silencer = this.audioContext.createGain();
    silencer.gain.value = 0;
    this.workletNode.connect(silencer);
    silencer.connect(this.audioContext.destination);

    // Detect unexpected device disconnection.
    for (const track of this.stream.getAudioTracks()) {
      track.onended = () => { this.trackEndedCallback?.(); };
    }
  }

  /**
   * Registers a callback that receives each raw PCM chunk as it arrives from
   * the audio worklet. Used by streaming transcription backends to feed the
   * model while recording is still active.
   */
  onChunk(cb: (samples: Float32Array) => void): void {
    this.chunkCallback = cb;
  }

  /**
   * Returns a snapshot of the current time-domain audio signal as normalised
   * per-sample amplitudes in [0, 1]. The caller buckets this into display bars.
   * Returns an empty array when no pipeline is active.
   */
  getWaveformData(): Float32Array {
    if (this.analyser === null) return new Float32Array(0);
    const buffer = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(buffer);
    const result = new Float32Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      result[i] = Math.abs(buffer[i] - 128) / 128;
    }
    return result;
  }

  /**
   * Immediately releases the microphone and closes the AudioContext without
   * resampling. Use this on cancel paths and on the streaming stop path where
   * PCM is consumed by the worker rather than the pipeline.
   *
   * On macOS/Chromium the OS mic indicator does not clear until the AudioContext
   * close promise resolves -- this method awaits that promise before returning.
   */
  async release(): Promise<void> {
    this.trackEndedCallback = null;
    this.chunkCallback = null;
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
   * Use this only on the batch transcription path where the full buffer is needed.
   */
  async stop(): Promise<PcmAudio> {
    this.chunkCallback = null;
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
