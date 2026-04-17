/** Purely presentational spinner shown while transcription is in progress. */
export function ProcessingIndicator(): React.JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <div className="h-6 w-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      <span className="text-sm text-foreground">Transcribing…</span>
    </div>
  );
}
