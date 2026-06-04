import { PcmAudio } from './PcmAudio';

/**
 * AudioPipeline manages microphone capture and PCM accumulation for a single
 * recording session.
 */
export class AudioPipeline {
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private pcmChunks: Float32Array[] = [];
  private trackEndedCallback: (() => void) | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private streamingCallback: ((samples: Float32Array) => void) | null = null;

  /**
   * Starts microphone capture.
   *
   * @param sampleRate - AudioContext sample rate. Pass 16000 for streaming
   *   backends so the OS resamples before chunks reach the worklet; omit to
   *   use the device native rate (batch path resamples via OfflineAudioContext).
   */
  async start(deviceId: string, sampleRate?: number): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: deviceId } },
      video: false,
    });

    const contextOptions = sampleRate !== undefined ? { sampleRate } : undefined;
    this.audioContext = new AudioContext(contextOptions);
    await this.audioContext.audioWorklet.addModule(
      new URL('./PcmCollectorProcessor.js', import.meta.url),
    );

    const source = this.audioContext.createMediaStreamSource(this.stream);

    this.pcmChunks = [];
    this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-collector');
    this.workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
      // Only accumulate when no streaming callback is registered.
      if (this.streamingCallback === null) {
        this.pcmChunks.push(event.data);
      } else {
        this.streamingCallback(event.data);
      }
    };
    source.connect(this.workletNode);

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
    this.streamingCallback = cb;
  }

  /**
   * Immediately releases the microphone and closes the AudioContext without
   * resampling. Use this on cancel paths and on the streaming stop path where
   * PCM is consumed by the worker rather than the pipeline.
   */
  async release(): Promise<void> {
    this.trackEndedCallback = null;
    this.streamingCallback = null;
    this.stream?.getAudioTracks().forEach((t) => { t.stop(); });
    this.stream = null;
    this.workletNode?.disconnect();
    this.workletNode?.port.close();
    this.workletNode = null;
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
    this.streamingCallback = null;
    this.stream?.getAudioTracks().forEach((t) => { t.stop(); });
    this.stream = null;
    this.workletNode?.disconnect();
    this.workletNode?.port.close();
    this.workletNode = null;

    const sampleRate = this.audioContext?.sampleRate ?? 44100;
    const mergedAudio = PcmAudio.mergeChunks(this.pcmChunks, sampleRate, 1);
    this.pcmChunks = [];

    await this.audioContext?.close();
    this.audioContext = null;

    return mergedAudio.resampleTo(16000);
  }

  /**
   * Registers a callback that fires if the MediaStreamTrack ends unexpectedly
   * (e.g. the microphone is unplugged). The caller should treat this as a
   * cancellation.
   */
  onTrackEnded(cb: () => void): void {
    this.trackEndedCallback = cb;
  }

}
