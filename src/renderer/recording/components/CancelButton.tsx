interface CancelButtonProps {
  readonly onCancel: () => void;
}

/**
 * Cancels the current recording session.
 *
 * Delegates all cancellation logic to the provided callback so this component
 * remains free of IPC and audio pipeline concerns.
 */
export function CancelButton({ onCancel }: CancelButtonProps): React.JSX.Element {
  return <button onClick={onCancel}>Cancel</button>;
}
