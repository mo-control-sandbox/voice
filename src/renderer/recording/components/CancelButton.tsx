import { ipc } from '../../gen/ipc';
import type { AudioPipeline } from '../audio/AudioPipeline';

interface CancelButtonProps {
  readonly sessionId: string;
  readonly pipeline: AudioPipeline | null;
}

/**
 * Cancels the current recording session.
 *
 * Stops the audio track immediately for responsive UX, then notifies the
 * main process via IPC so the FSM transitions to idle.
 */
export function CancelButton({ sessionId, pipeline }: CancelButtonProps): React.JSX.Element {
  async function handleCancel(): Promise<void> {
    // Await release so the OS mic indicator clears reliably.
    await pipeline?.release();
    await ipc.recording.CancelRecording({ sessionId, reason: 'USER_CANCELLED' });
  }

  return (
    <button
      onClick={() => { void handleCancel(); }}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/20 text-destructive transition-colors hover:bg-destructive/40"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      aria-label="Cancel recording"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );
}
