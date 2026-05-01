import {
  BaseStreamer,
} from '@huggingface/transformers';
import type {
  FeaturesTensor,
  FirstChunkOutput,
} from './TypeShim';
import type { StreamingWorkerResult, StreamingTranscriber } from '../streaming/StreamingWorkerRuntime';
import { StreamingAudioBuffer } from '../streaming/StreamingAudioBuffer';
import type { VoxtralRuntimeHandle } from './VoxtralInMemoryModel';

/**
 * Runs one streaming decode using current model state and buffered audio.
 */
export class VoxtralStreamingTranscriber implements StreamingTranscriber<VoxtralRuntimeHandle> {
  constructor(
    private readonly audioBuffer: StreamingAudioBuffer,
    private readonly emit: (message: StreamingWorkerResult) => void,
  ) {}

  /**
   * Transcribes the current buffered stream and emits partial results.
   */
  async transcribe(
    runtime: VoxtralRuntimeHandle,
    requestId: string,
  ): Promise<string> {
    const voxtralModel = runtime.model;
    const voxtralProcessor = runtime.processor;
    const numSamplesFirst = voxtralProcessor.num_samples_first_audio_chunk;

    // With a sealed buffer the condition resolves immediately; the length guard
    // handles the edge case where the recording was too short to produce a chunk.
    await this.audioBuffer.waitUntil(
      () => this.audioBuffer.length >= numSamplesFirst || this.audioBuffer.isStopped() || this.audioBuffer.isSealed(),
    );
    if (this.audioBuffer.isStopped() || this.audioBuffer.length < numSamplesFirst) return '';

    const firstChunkInputs = await voxtralProcessor._call(
      this.audioBuffer.subarray(0, numSamplesFirst),
      { is_streaming: true, is_first_audio_chunk: true },
    ) as FirstChunkOutput;

    const { hop_length, n_fft } = voxtralProcessor.feature_extractor.config;
    const winHalf = Math.floor(n_fft / 2);
    const samplesPerTok: number = voxtralProcessor.audio_length_per_tok * hop_length;
    const samplesPerChunk: number = voxtralProcessor.num_samples_per_audio_chunk;

    // Tracks how many samples have been trimmed from the front of the audio buffer.
    let trimmedSamples = 0;

    const inputFeaturesGenerator = async function* (
      buffer: StreamingAudioBuffer,
    ): AsyncGenerator<FeaturesTensor> {
      yield firstChunkInputs.input_features;

      let melFrameIdx = voxtralProcessor.num_mel_frames_first_audio_chunk;
      let startIdx = melFrameIdx * hop_length - winHalf; // absolute

      while (!buffer.isStopped()) {
        const endNeeded = startIdx + samplesPerChunk; // absolute

        // Sealed buffer: stop when no more audio can satisfy the next chunk.
        if (buffer.isSealed() && buffer.length + trimmedSamples < endNeeded) break;

        await buffer.waitUntil(() => buffer.length + trimmedSamples >= endNeeded || buffer.isStopped());
        if (buffer.isStopped()) break;

        // Greedily absorb any additional complete tokens already in the buffer.
        let batchEndSample = endNeeded; // absolute
        while (batchEndSample + samplesPerTok <= buffer.length + trimmedSamples) {
          batchEndSample += samplesPerTok;
        }

        const chunkInputs = await voxtralProcessor._call(
          buffer.slice(startIdx - trimmedSamples, batchEndSample - trimmedSamples),
          { is_streaming: true, is_first_audio_chunk: false },
        );

        yield chunkInputs.input_features;
        melFrameIdx += chunkInputs.input_features.dims[2];
        startIdx = melFrameIdx * hop_length - winHalf; // new absolute window start

        // Discard samples that precede the new window start.
        const absLen = trimmedSamples + buffer.length;
        const newTrim = Math.max(trimmedSamples, Math.min(startIdx, absLen));
        const toTrim = newTrim - trimmedSamples;
        if (toTrim > 0) {
          buffer.trimFront(toTrim);
          trimmedSamples = newTrim;
        }
      }
    };

    const { tokenizer } = voxtralProcessor;
    const specialIds = new Set<bigint>(tokenizer.all_special_ids.map((id) => BigInt(id)));
    let tokenCache: bigint[] = [];
    let printLen = 0;
    let isPrompt = true;
    let fullText = '';

    const flushDecodedText = (): string => {
      if (tokenCache.length === 0) return '';
      const decoded = tokenizer.decode(tokenCache, { skip_special_tokens: true });
      const newText = decoded.slice(printLen);
      printLen = decoded.length;
      fullText += newText;
      return newText;
    };

    const buffer = this.audioBuffer;
    const emit = this.emit;
    const streamer = new (class extends BaseStreamer {
      put(value: bigint[][]): void {
        if (buffer.isStopped()) return;
        // The first batch is the prompt echo; discard it.
        if (isPrompt) {
          isPrompt = false;
          return;
        }
        const tokens = value[0];
        if (tokens.length === 1 && specialIds.has(tokens[0])) return;
        tokenCache = tokenCache.concat(tokens);
        const newText = flushDecodedText();
        if (newText.length > 0) {
          emit({
            type: 'partial-result',
            requestId,
            text: newText,
          });
        }
      }

      end(): void {
        if (buffer.isStopped()) {
          tokenCache = [];
          printLen = 0;
          isPrompt = true;
          return;
        }
        flushDecodedText();
        tokenCache = [];
        printLen = 0;
        isPrompt = true;
      }
    })();

    try {
      await voxtralModel.generate({
        input_ids: firstChunkInputs.input_ids,
        input_features: inputFeaturesGenerator(this.audioBuffer),
        stopping_criteria: null,
        max_new_tokens: 4096,
        streamer,
      });
    } catch (err) {
      // model.generate may throw when the generator exits early via stopRequested.
      if (!this.audioBuffer.isStopped()) throw err;
    }

    return fullText;
  }
}
