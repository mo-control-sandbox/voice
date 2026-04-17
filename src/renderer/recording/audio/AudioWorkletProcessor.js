/**
 * AudioWorkletProcessor that relays Float32Array PCM chunks from the audio
 * rendering thread to the main thread via MessagePort.
 *
 * Registered as 'pcm-collector' in AudioPipeline.ts.
 */
class PcmCollectorProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input.length > 0 && input[0].length > 0) {
      // Clone the buffer — the underlying memory is recycled after process() returns.
      this.port.postMessage(input[0].slice());
    }
    return true; // keep processor alive
  }
}

registerProcessor('pcm-collector', PcmCollectorProcessor);
