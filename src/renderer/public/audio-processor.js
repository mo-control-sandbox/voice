/**
 * AudioWorkletProcessor that forwards raw Float32 PCM input chunks to the
 * main thread so they can be accumulated and resampled for transcription.
 *
 * Registered as "pcm-accumulator".
 */
class PcmAccumulatorProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel !== undefined && channel.length > 0) {
      // Transfer ownership of a copy to avoid holding the buffer after the
      // process() call completes.
      const copy = channel.slice(0);
      this.port.postMessage(copy, [copy.buffer]);
    }
    // Returning true keeps the processor alive.
    return true;
  }
}

registerProcessor('pcm-accumulator', PcmAccumulatorProcessor);
