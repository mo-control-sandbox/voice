import './CancelButton.css';

interface CancelButtonProps {
  readonly onCancel: () => void;
}

/**
 * Cancels the current recording or processing session.
 *
 * Delegates all cancellation logic to the provided callback so this component
 * remains free of IPC and audio pipeline concerns.
 */
export function CancelButton({ onCancel }: CancelButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      className="cancel-button"
      onClick={onCancel}
      aria-label="Cancel recording"
    >
      <svg
        className="cancel-button__icon"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <line x1="3.5" y1="3.5" x2="12.5" y2="12.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <line x1="12.5" y1="3.5" x2="3.5" y2="12.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    </button>
  );
}
