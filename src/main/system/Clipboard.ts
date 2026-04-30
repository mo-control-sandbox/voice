import { clipboard } from '@mobrowser/api';
import { native } from '../gen/native';

/**
 * Writes transcribed text to the clipboard and, when the Accessibility
 * permission allows it, synthesises Cmd+V into the current frontmost app.
 *
 * The clipboard write always happens so the user can paste manually even if
 * automatic paste is unavailable.
 */
export class Clipboard {
  private readonly queue: string[] = [];
  private isProcessing = false;

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
   * Drops queued pasteText() calls that have not started yet.
   * A currently running paste cannot be interrupted mid-flight.
   */
  cancelPending(): void {
    this.queue.length = 0;
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
    await native.automation.Paste({});
  }
}
