import type { JSX } from 'react';

/** Spinner shown while transcription is in progress. */
export function ProcessingIndicator(): JSX.Element {
  return (
    <div className="flex items-center justify-center h-10">
      <div className="w-5 h-5 rounded-full border-2 border-muted border-t-primary animate-spin" />
    </div>
  );
}
