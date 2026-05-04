import { clipboard } from '@mobrowser/api';
import { native } from '../gen/native';

// An arbitrary number that makes sure the clipboard paste's
// are serial and ensures smooth experience.
const STREAMING_PASTE_INTERVAL_MS = 500;

/**
 * Clipboard-backed text paste executor.
 */
export class Clipboard {
  private readonly queue: string[] = [];
  private isProcessing = false;
  private streamingBuffer = '';
  private streamingFlushTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Writes text to the clipboard and synthesises Cmd+V if Accessibility is granted.
   *
   * Calls are queued and processed serially to avoid overlapping paste operations.
   */
  pasteText(text: string): void {
    this.queue.push(text);
    this.processQueue();
  }

  /**
   * Accumulates streaming text and pastes it every fixed interval.
   */
  queueStreamingText(text: string): void {
    this.streamingBuffer += text;
    if (this.streamingFlushTimer !== null) return;
    this.streamingFlushTimer = setTimeout(() => {
      this.streamingFlushTimer = null;
      this.flushStreamingBuffer();
    }, STREAMING_PASTE_INTERVAL_MS);
  }

  /**
   * Drops queued pasteText() calls that have not started yet.
   * A currently running paste cannot be interrupted mid-flight.
   */
  cancelPending(): void {
    this.queue.length = 0;
    this.streamingBuffer = '';
    if (this.streamingFlushTimer !== null) {
      clearTimeout(this.streamingFlushTimer);
      this.streamingFlushTimer = null;
    }
  }

  private processQueue(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;
    void (async () => {
      try {
        while (this.queue.length > 0) {
          const text = this.queue.shift();
          if (text === undefined) break;
          await this.doPasteText(text);
        }
      } finally {
        this.isProcessing = false;
      }
    })();
  }

  private async doPasteText(text: string): Promise<void> {
    clipboard.write('text/plain', text);
    await new Promise((resolve) => { setTimeout(resolve, 20); });
    await native.automation.Paste({});
  }

  /**
   * Moves the accumulated streaming buffer into the serial paste queue.
   */
  private flushStreamingBuffer(): void {
    if (this.streamingBuffer.length === 0) return;
    const text = this.streamingBuffer;
    this.streamingBuffer = '';
    this.queue.push(text);
    this.processQueue();
  }
}
