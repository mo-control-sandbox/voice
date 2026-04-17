const DEFAULT_SAMPLE_RATE = 16000;
const NUM_CHANNELS = 1;
const DEFAULT_BITS_PER_SAMPLE = 32;
const AUDIO_FORMAT = 3; // IEEE_FLOAT.
const WAV_HEADER_BYTES = 44;

/**
 * Encodes raw PCM samples into a WAV file.
 *
 * Produces mono IEEE float audio. Defaults to 16 kHz / 32-bit,
 * matching the output of the Web Audio API capture pipeline.
 */
export function encodeWav(
  pcm: Uint8Array,
  sampleRate = DEFAULT_SAMPLE_RATE,
  bitsPerSample = DEFAULT_BITS_PER_SAMPLE,
): Uint8Array {
  const header = buildHeader(pcm.byteLength, sampleRate, bitsPerSample);
  const wav = new Uint8Array(header.byteLength + pcm.byteLength);
  wav.set(new Uint8Array(header), 0);
  wav.set(pcm, header.byteLength);
  return wav;
}

function buildHeader(pcmByteLength: number, sampleRate: number, bitsPerSample: number): ArrayBuffer {
  const header = new ArrayBuffer(WAV_HEADER_BYTES);
  const view = new DataView(header);

  const byteRate = (sampleRate * NUM_CHANNELS * bitsPerSample) / 8;
  const blockAlign = (NUM_CHANNELS * bitsPerSample) / 8;

  // RIFF chunk descriptor
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, (WAV_HEADER_BYTES - 8) + pcmByteLength, true);
  writeAscii(view, 8, 'WAVE');

  // fmt sub-chunk
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, AUDIO_FORMAT, true);
  view.setUint16(22, NUM_CHANNELS, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeAscii(view, 36, 'data');
  view.setUint32(40, pcmByteLength, true);

  return header;
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}
