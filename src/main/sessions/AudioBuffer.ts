import { encodeWav } from './wav';

/**
 * A PCM audio buffer.
 */
export class AudioBuffer {
  private readonly chunks: Uint8Array[] = [];
  private pcmByteLength = 0;

  append(pcm: Uint8Array): void {
    this.chunks.push(pcm);
    this.pcmByteLength += pcm.byteLength;
  }

  toWavBytes(): Uint8Array {
    const pcm = new Uint8Array(this.pcmByteLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      pcm.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return encodeWav(pcm);
  }
}
