import { ipc } from '../../gen/ipc';
import type { PcmAudio } from '../audio/PcmAudio';
import type { TranscriptionBackend, TranscriptionResult } from './TranscriptionBackend';

/**
 * Transcription backend that delegates to macOS built-in speech recognition
 * via the main process IPC service.
 *
 * The Float32Array samples are transferred as raw bytes (little-endian float32).
 */
export class BuiltinBackend implements TranscriptionBackend {
  async transcribe(
    audio: PcmAudio,
    language: string | null,
    signal: AbortSignal,
  ): Promise<TranscriptionResult | null> {
    const pcmBytes = new Uint8Array(
      audio.samples.buffer,
      audio.samples.byteOffset,
      audio.samples.byteLength,
    );

    try {
      const response = await ipc.builtinSpeech.Transcribe({
        pcm: pcmBytes,
        language: language ?? '',
      });

      return signal.aborted
        ? null
        : { text: response.text, detectedLanguage: response.detectedLanguage };
    } catch (err) {
      console.error('[BuiltinBackend] Transcription failed:', err);
      return null;
    }
  }
}
