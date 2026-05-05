import type { HistoryService } from '../HistoryService';
import type { HistoryAudioBlobWorkerResult } from './HistoryAudioBlobWorker';

const AUDIO_CHUNK_SIZE_BYTES = 256 * 1024;

/**
 * Loads persisted session audio into a Blob URL using a dedicated worker.
 */
export class HistoryAudioBlobLoader {
  private readonly worker = new Worker(new URL('./HistoryAudioBlobWorker.ts', import.meta.url), { type: 'module' });
  private nextRequestId = 0;

  constructor(private readonly historyService: HistoryService) {}

  /**
   * Disposes this loader and terminates the underlying worker.
   */
  dispose(): void {
    this.worker.terminate();
  }

  /**
   * Loads one session audio blob URL.
   */
  async loadSessionAudioBlobUrl(sessionId: string, signal: AbortSignal): Promise<string | null> {
    const info = await this.historyService.getAudioInfo(sessionId);
    if (!info.hasAudio || info.totalBytes === 0) {
      return null;
    }

    const requestId = String(this.nextRequestId++);
    this.worker.postMessage({ type: 'start', requestId });

    const onAbort = (): void => {
      this.worker.postMessage({ type: 'cancel', requestId });
    };
    signal.addEventListener('abort', onAbort, { once: true });

    try {
      let offset = 0;
      while (offset < info.totalBytes) {
        if (signal.aborted) {
          return null;
        }
        const remaining = info.totalBytes - offset;
        const length = Math.min(AUDIO_CHUNK_SIZE_BYTES, remaining);
        const response = await this.historyService.getAudioChunk(sessionId, offset, length);
        const chunk = response.audioData;
        if (chunk.byteLength === 0) {
          break;
        }
        const transfer = chunk.slice().buffer;
        this.worker.postMessage({ type: 'chunk', requestId, bytes: transfer }, [transfer]);
        offset += chunk.byteLength;
      }

      if (signal.aborted) {
        return null;
      }

      return await this.finalizeBlob(requestId, signal);
    } finally {
      signal.removeEventListener('abort', onAbort);
    }
  }

  /**
   * Waits for one completed worker assembly result and converts it to an object URL.
   */
  private finalizeBlob(requestId: string, signal: AbortSignal): Promise<string | null> {
    return new Promise((resolve) => {
      const onAbort = (): void => {
        this.worker.postMessage({ type: 'cancel', requestId });
        this.worker.removeEventListener('message', onMessage);
        resolve(null);
      };

      const onMessage = (event: MessageEvent<HistoryAudioBlobWorkerResult>): void => {
        if (event.data.requestId !== requestId) return;
        signal.removeEventListener('abort', onAbort);
        this.worker.removeEventListener('message', onMessage);
        if (event.data.type === 'error') {
          console.error(`[HistoryAudioBlobLoader] worker error: ${event.data.error}`);
          resolve(null);
          return;
        }
        resolve(URL.createObjectURL(event.data.blob));
      };

      signal.addEventListener('abort', onAbort, { once: true });
      this.worker.addEventListener('message', onMessage);
      this.worker.postMessage({ type: 'complete', requestId });
    });
  }
}

