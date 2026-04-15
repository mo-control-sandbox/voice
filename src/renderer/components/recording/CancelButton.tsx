import type { JSX } from 'react';
import { Button } from '@/components/ui/button';
import { ipc } from '@/gen/ipc';

interface CancelButtonProps {
  /** Invoked when the cancel action completes. */
  onCancel: () => void
}

/** Sends a cancel request to the main process then invokes the onCancel callback. */
export function CancelButton({ onCancel }: CancelButtonProps): JSX.Element {
  const handleClick = (): void => {
    void ipc.recording.CancelRecording({}).finally(onCancel);
  };

  return (
    <Button variant="ghost" size="icon" onClick={handleClick} aria-label="Cancel recording">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </Button>
  );
}
