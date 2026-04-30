/**
 * Immutable PCM audio value object with explicit format metadata.
 *
 * Encapsulates sample data and format-derived operations used by transcription,
 * storage, and metrics flows.
 */
export class PcmAudio {
  /**
   * Raw float32 samples, normalised to [-1, 1].
   */
  readonly samples: Float32Array;

  /**
   * Samples per second.
   */
  readonly sampleRate: number;

  /**
   * Number of interleaved audio channels.
   */
  readonly channelCount: number;

  constructor(samples: Float32Array, sampleRate: number, channelCount: number) {
    this.samples = samples;
    this.sampleRate = sampleRate;
    this.channelCount = channelCount;
  }

  /**
   * Returns audio duration derived from sample count and sample rate.
   */
  get durationSeconds(): number {
    if (this.sampleRate <= 0) return 0;
    return this.samples.length / this.sampleRate;
  }

  /**
   * Returns a new PCM buffer with trailing silence appended.
   */
  withSilencePadding(seconds: number): PcmAudio {
    const paddingSamples = Math.round(this.sampleRate * seconds);
    const padded = new Float32Array(this.samples.length + paddingSamples);
    padded.set(this.samples);
    return new PcmAudio(padded, this.sampleRate, this.channelCount);
  }

  /**
   * Returns a byte-level view of the PCM sample payload.
   */
  toPcmBytes(): Uint8Array {
    return new Uint8Array(
      this.samples.buffer,
      this.samples.byteOffset,
      this.samples.byteLength,
    );
  }

  /**
   * Returns a copy resampled to the target sample rate.
   */
  async resampleTo(targetSampleRate: number): Promise<PcmAudio> {
    if (this.samples.length === 0) {
      return new PcmAudio(new Float32Array(0), targetSampleRate, this.channelCount);
    }

    const outputLength = Math.ceil((this.samples.length * targetSampleRate) / this.sampleRate);
    const offlineCtx = new OfflineAudioContext(this.channelCount, outputLength, targetSampleRate);
    const buffer = offlineCtx.createBuffer(this.channelCount, this.samples.length, this.sampleRate);
    buffer.copyToChannel(new Float32Array(this.samples), 0);

    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    const rendered = await offlineCtx.startRendering();
    return new PcmAudio(rendered.getChannelData(0), targetSampleRate, this.channelCount);
  }

  /**
   * Creates one PCM buffer by concatenating chunked sample payloads.
   */
  static mergeChunks(
    chunks: readonly Float32Array[],
    sampleRate: number,
    channelCount: number,
  ): PcmAudio {
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Float32Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return new PcmAudio(merged, sampleRate, channelCount);
  }
}
