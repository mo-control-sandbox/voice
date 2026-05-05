/**
 * Command sent from renderer to the audio blob worker.
 */
type HistoryAudioBlobWorkerCommand =
  | { type: 'start'; requestId: string }
  | { type: 'chunk'; requestId: string; bytes: ArrayBuffer }
  | { type: 'complete'; requestId: string }
  | { type: 'cancel'; requestId: string };

/**
 * Result sent from the audio blob worker back to renderer.
 */
export type HistoryAudioBlobWorkerResult =
  | { type: 'loaded'; requestId: string; blob: Blob }
  | { type: 'error'; requestId: string; error: string };

/**
 * In-progress state for one blob assembly request.
 */
interface ActiveBuild {
  requestId: string;
  chunks: ArrayBuffer[];
}

let activeBuild: ActiveBuild | null = null;

/**
 * Handles one command for incremental blob assembly.
 */
function handleCommand(command: HistoryAudioBlobWorkerCommand): void {
  switch (command.type) {
    case 'start':
      activeBuild = {
        requestId: command.requestId,
        chunks: [],
      };
      return;
    case 'chunk':
      if (activeBuild?.requestId !== command.requestId) {
        return;
      }
      activeBuild.chunks.push(command.bytes);
      return;
    case 'cancel':
      if (activeBuild?.requestId === command.requestId) {
        activeBuild = null;
      }
      return;
    case 'complete':
      if (activeBuild?.requestId !== command.requestId) {
        return;
      }
      try {
        const blob = new Blob(activeBuild.chunks, { type: 'audio/wav' });
        const message: HistoryAudioBlobWorkerResult = {
          type: 'loaded',
          requestId: command.requestId,
          blob,
        };
        postMessage(message);
        activeBuild = null;
      } catch (error) {
        const message: HistoryAudioBlobWorkerResult = {
          type: 'error',
          requestId: command.requestId,
          error: error instanceof Error ? error.message : String(error),
        };
        postMessage(message);
        activeBuild = null;
      }
      return;
  }
}

self.onmessage = (event: MessageEvent<HistoryAudioBlobWorkerCommand>) => {
  handleCommand(event.data);
};
