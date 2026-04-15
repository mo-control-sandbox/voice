import type { TranscriptionService, TranscriptionResult, TranscriptionInput } from '../../shared/types';
import type { BuiltinSpeechTranscriptionService } from './BuiltinSpeechTranscriptionService';
import type { PreferencesService } from './PreferencesService';

/** Minimal interface required by TranscriptionRouter — avoids coupling to the full LocalModelService generic. */
interface LocalInferenceRunner {
  run(input: TranscriptionInput): Promise<TranscriptionResult>;
}

/**
 * Routes a transcription request to either the local Whisper backend or the
 * macOS built-in recogniser, based on the `activeModelId` preference.
 */
export class TranscriptionRouter implements TranscriptionService {
  private readonly localModelService: LocalInferenceRunner;
  private readonly builtinService: BuiltinSpeechTranscriptionService;
  private readonly preferences: PreferencesService;

  constructor(
    localModelService: LocalInferenceRunner,
    builtinService: BuiltinSpeechTranscriptionService,
    preferences: PreferencesService,
  ) {
    this.localModelService = localModelService;
    this.builtinService = builtinService;
    this.preferences = preferences;
  }

  /** Transcribes `audio` using the active backend (builtin or local model). */
  transcribe(audio: Float32Array, language: string | null): Promise<TranscriptionResult> {
    const activeModelId = this.preferences.get('activeModelId');

    if (activeModelId === 'builtin') {
      return this.builtinService.transcribe(audio, language);
    }

    return this.localModelService.run({ audio, language });
  }
}
