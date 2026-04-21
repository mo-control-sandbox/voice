import './ProcessingIndicator.css';

/** Spinner + label shown while transcription inference is running. */
export function ProcessingIndicator(): React.JSX.Element {
  return (
    <div className="processing-indicator">
      <span className="processing-indicator__spinner" aria-hidden="true" />
      <span className="processing-indicator__label">Transcribing…</span>
    </div>
  );
}
