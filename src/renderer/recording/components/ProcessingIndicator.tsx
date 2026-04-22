import './ProcessingIndicator.css';

/** Three-dot bounce animation shown while transcription inference is running. */
export function ProcessingIndicator(): React.JSX.Element {
  return (
    <div className="processing-indicator" aria-label="Transcribing">
      <span className="processing-indicator__dot" />
      <span className="processing-indicator__dot" />
      <span className="processing-indicator__dot" />
    </div>
  );
}
