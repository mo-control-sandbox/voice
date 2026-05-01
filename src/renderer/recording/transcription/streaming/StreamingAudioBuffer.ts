/**
 * Owns the rolling audio stream buffer and session control flags.
 */
export class StreamingAudioBuffer {
  /**
   * Rolling buffer of all received samples that are not yet trimmed.
   */
  private samples: Float32Array = new Float32Array(0);

  /**
   * Indicates whether the active session has been stopped.
   */
  private stopRequested = false;

  /**
   * Indicates whether the active session input stream was sealed.
   */
  private audioSealed = false;

  /**
   * Starts a new session without discarding already received pre-start chunks.
   */
  beginSession(): void {
    this.stopRequested = false;
    this.audioSealed = false;
  }

  /**
   * Appends one chunk of PCM samples to the rolling buffer.
   */
  append(chunk: Float32Array): void {
    const combined = new Float32Array(this.samples.length + chunk.length);
    combined.set(this.samples);
    combined.set(chunk, this.samples.length);
    this.samples = combined;
  }

  /**
   * Marks the active input stream as sealed.
   */
  seal(): void {
    this.audioSealed = true;
  }

  /**
   * Marks the active session as stopped.
   */
  requestStop(): void {
    this.stopRequested = true;
  }

  /**
   * Reports whether the active session was stopped.
   */
  isStopped(): boolean {
    return this.stopRequested;
  }

  /**
   * Reports whether the active session input stream was sealed.
   */
  isSealed(): boolean {
    return this.audioSealed;
  }

  /**
   * Returns the number of buffered samples.
   */
  get length(): number {
    return this.samples.length;
  }

  /**
   * Returns a view into the buffered samples.
   */
  subarray(start: number, end?: number): Float32Array {
    return this.samples.subarray(start, end);
  }

  /**
   * Returns a copied slice of the buffered samples.
   */
  slice(start: number, end?: number): Float32Array {
    return this.samples.slice(start, end);
  }

  /**
   * Drops the given number of samples from the front of the buffer.
   */
  trimFront(count: number): void {
    if (count <= 0) return;
    this.samples = this.samples.slice(count);
  }

  /**
   * Clears session data after one inference completes.
   */
  resetAfterSession(): void {
    this.samples = new Float32Array(0);
    this.audioSealed = false;
  }

  /**
   * Polls until the predicate returns true.
   */
  waitUntil(condition: () => boolean): Promise<void> {
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
}
