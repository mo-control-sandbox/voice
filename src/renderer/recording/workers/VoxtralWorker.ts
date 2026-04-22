import {
  env,
  VoxtralRealtimeForConditionalGeneration,
  VoxtralRealtimeProcessor,
  BaseStreamer,
  type PreTrainedTokenizer,
} from '@huggingface/transformers';
import { MODEL_CACHE_PARTITION } from '../../services/ModelCacheKey';

// Configure Transformers.js to read pre-downloaded model files from the same
// browser Cache API partition used by RendererModelCache.
env.useBrowserCache = true;
env.cacheKey = MODEL_CACHE_PARTITION;

// ── Local shape types ─────────────────────────────────────────────────────────
// The processor's _call method returns `Promise<any>`. These interfaces encode
// only the properties we read, letting the compiler verify our access patterns.

/** Shape consumed from the first-chunk processor call. */
interface FirstChunkOutput {
  readonly input_ids: unknown;
  readonly input_features: FeaturesTensor;
}

/** Shape consumed from subsequent chunk processor calls. */
interface SubsequentChunkOutput {
  readonly input_features: FeaturesTensor;
}

/** The parts of a features tensor this worker uses. */
interface FeaturesTensor {
  readonly dims: readonly number[];
}

/** The subset of the feature extractor config we read. */
interface FeatureExtractorConfig {
  readonly hop_length: number;
  readonly n_fft: number;
}

/**
 * Typed view of the VoxtralRealtimeProcessor internals we access.
 *
 * The base Processor type declares `feature_extractor` and `tokenizer` as
 * possibly undefined, but they are always present for this model. A single
 * cast to this interface avoids non-null assertions on every access.
 */
interface ProcessorFacade extends VoxtralRealtimeProcessor {
  readonly feature_extractor: { readonly config: FeatureExtractorConfig };
  readonly tokenizer: PreTrainedTokenizer;
}

/** Messages sent from the main thread to the worker. */
type IncomingMessage =
  | { type: 'load'; modelId: string }
  | { type: 'run'; samples: Float32Array; requestId: string }
  | { type: 'stop' };

/** Messages sent from the worker back to the main thread. */
export type VoxtralWorkerResult =
  | { type: 'loaded' }
  | { type: 'result'; requestId: string; text: string }
  | { type: 'error'; requestId: string; error: string };

// ── Worker state ──────────────────────────────────────────────────────────────

let model: VoxtralRealtimeForConditionalGeneration | null = null;
let processor: VoxtralRealtimeProcessor | null = null;
let currentModelId: string | null = null;

// Mutable inference flags. Reading them through getter functions (below)
// prevents TypeScript's control-flow analysis from narrowing the values to
// literals inside async closures. CFA does not narrow function-call return
// types, so isStopped() / isAudioSealed() always evaluate to `boolean`.
const runFlags = { stopRequested: false, audioSealed: false };
let audioBuffer = new Float32Array(0);

function isStopped(): boolean { return runFlags.stopRequested; }
function isAudioSealed(): boolean { return runFlags.audioSealed; }

// ── Message handler ───────────────────────────────────────────────────────────

self.onmessage = (event: MessageEvent<IncomingMessage>): void => {
  const msg = event.data;

  if (msg.type === 'load') {
    void loadModel(msg.modelId);
    return;
  }

  if (msg.type === 'stop') {
    runFlags.stopRequested = true;
    return;
  }

  // msg.type === 'run'
  audioBuffer = msg.samples;
  runFlags.audioSealed = true;
  runFlags.stopRequested = false;
  void runInference(msg.requestId);
};

// ── Model loading ─────────────────────────────────────────────────────────────

async function loadModel(modelId: string): Promise<void> {
  if (currentModelId === modelId && model !== null) {
    self.postMessage({ type: 'loaded' } satisfies VoxtralWorkerResult);
    return;
  }

  try {
    // from_pretrained is typed to return the PreTrainedModel base class.
    // The cast narrows to the concrete subclass we requested.
    model = await VoxtralRealtimeForConditionalGeneration.from_pretrained(modelId, {
      dtype: {
        audio_encoder: 'q4f16',
        embed_tokens: 'q4f16',
        decoder_model_merged: 'q4f16',
      },
      device: 'webgpu',
    }) as VoxtralRealtimeForConditionalGeneration;

    processor = await VoxtralRealtimeProcessor.from_pretrained(
      modelId,
    ) as VoxtralRealtimeProcessor;

    currentModelId = modelId;
    self.postMessage({ type: 'loaded' } satisfies VoxtralWorkerResult);
  } catch (err) {
    model = null;
    processor = null;
    console.error('[VoxtralWorker] Failed to load model:', err);
  }
}

// ── Inference ─────────────────────────────────────────────────────────────────

/** Polls until the predicate returns true. */
function waitUntil(condition: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    if (condition()) {
      resolve();
      return;
    }
    const interval = setInterval(() => {
      if (condition()) {
        clearInterval(interval);
        resolve();
      }
    }, 50);
  });
}

async function runInference(requestId: string): Promise<void> {
  if (model === null || processor === null) {
    self.postMessage({
      type: 'error',
      requestId,
      error: 'Model not loaded',
    } satisfies VoxtralWorkerResult);
    return;
  }

  // Cast once to the typed facade to avoid repeated non-null assertions on
  // the `feature_extractor` and `tokenizer` properties.
  const proc = processor as unknown as ProcessorFacade;

  try {
    const text = await runStreamingTranscription(model, proc);
    if (!isStopped()) {
      self.postMessage({
        type: 'result',
        requestId,
        text: text.trim(),
      } satisfies VoxtralWorkerResult);
    }
  } catch (err) {
    if (!isStopped()) {
      self.postMessage({
        type: 'error',
        requestId,
        error: err instanceof Error ? err.message : String(err),
      } satisfies VoxtralWorkerResult);
    }
  } finally {
    audioBuffer = new Float32Array(0);
    runFlags.audioSealed = false;
  }
}

async function runStreamingTranscription(
  voxtralModel: VoxtralRealtimeForConditionalGeneration,
  voxtralProcessor: ProcessorFacade,
): Promise<string> {
  const numSamplesFirst = voxtralProcessor.num_samples_first_audio_chunk;

  // With a sealed buffer the condition resolves immediately; the length guard
  // handles the edge case where the recording was too short to produce a chunk.
  await waitUntil(
    () => audioBuffer.length >= numSamplesFirst || isStopped() || isAudioSealed(),
  );
  if (isStopped() || audioBuffer.length < numSamplesFirst) return '';

  const firstChunkInputs = await voxtralProcessor._call(
    audioBuffer.subarray(0, numSamplesFirst),
    { is_streaming: true, is_first_audio_chunk: true },
  ) as FirstChunkOutput;

  const { hop_length, n_fft } = voxtralProcessor.feature_extractor.config;
  const winHalf = Math.floor(n_fft / 2);
  const samplesPerTok: number = voxtralProcessor.audio_length_per_tok * hop_length;
  const samplesPerChunk: number = voxtralProcessor.num_samples_per_audio_chunk as number;

  async function* inputFeaturesGenerator(): AsyncGenerator<FeaturesTensor> {
    yield firstChunkInputs.input_features;

    let melFrameIdx = voxtralProcessor.num_mel_frames_first_audio_chunk;
    let startIdx = melFrameIdx * hop_length - winHalf;

    while (!isStopped()) {
      const endNeeded = startIdx + samplesPerChunk;

      // Sealed buffer: stop when no more audio can satisfy the next chunk.
      if (isAudioSealed() && audioBuffer.length < endNeeded) break;

      await waitUntil(() => audioBuffer.length >= endNeeded || isStopped());
      if (isStopped()) break;

      // Greedily absorb any additional complete tokens already in the buffer.
      let batchEndSample = endNeeded;
      while (batchEndSample + samplesPerTok <= audioBuffer.length) {
        batchEndSample += samplesPerTok;
      }

      const chunkInputs = await voxtralProcessor._call(
        audioBuffer.slice(startIdx, batchEndSample),
        { is_streaming: true, is_first_audio_chunk: false },
      ) as SubsequentChunkOutput;

      yield chunkInputs.input_features;
      melFrameIdx += chunkInputs.input_features.dims[2];
      startIdx = melFrameIdx * hop_length - winHalf;
    }
  }

  const { tokenizer } = voxtralProcessor;
  const specialIds = new Set<bigint>(tokenizer.all_special_ids.map((id) => BigInt(id)));
  let tokenCache: bigint[] = [];
  let printLen = 0;
  let isPrompt = true;
  let fullText = '';

  const flushDecodedText = (): void => {
    if (tokenCache.length === 0) return;
    const decoded = tokenizer.decode(tokenCache, { skip_special_tokens: true });
    const printableText = decoded.slice(printLen);
    printLen = decoded.length;
    fullText += printableText;
  };

  const streamer = new (class extends BaseStreamer {
    put(value: bigint[][]): void {
      if (isStopped()) return;
      // The first batch is the prompt echo — discard it.
      if (isPrompt) {
        isPrompt = false;
        return;
      }
      const tokens = value[0];
      if (tokens.length === 1 && specialIds.has(tokens[0])) return;
      tokenCache = tokenCache.concat(tokens);
      flushDecodedText();
    }

    end(): void {
      if (isStopped()) {
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
      input_features: inputFeaturesGenerator(),
      max_new_tokens: 4096,
      streamer,
    });
  } catch (err) {
    // model.generate may throw when the generator exits early via stopRequested.
    if (!isStopped()) throw err;
  }

  return fullText;
}
