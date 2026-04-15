import type { TranscriptionService, TranscriptionResult } from '../../shared/types';
import type { BuiltinSpeechService } from '../gen/native/builtin_speech';

/**
 * Transcription backend that delegates to the macOS on-device speech recogniser
 * via the native C++ module.
 */
export class BuiltinSpeechTranscriptionService implements TranscriptionService {
  private readonly nativeSpeech: BuiltinSpeechService;

  constructor(nativeSpeech: BuiltinSpeechService) {
    this.nativeSpeech = nativeSpeech;
  }

  /** Transcribes `audio` using macOS SFSpeechRecognizer. Returns empty `detectedLanguage`. */
  async transcribe(audio: Float32Array, language: string | null): Promise<TranscriptionResult> {
    const response = await this.nativeSpeech.RunBuiltinSpeechRecognition({
      pcm: Buffer.from(audio.buffer),
      language: language ?? '',
    });

    return {
      text: response.text,
      detectedLanguage: response.detectedLanguage.length > 0 ? response.detectedLanguage : null,
    };
  }
}
