/** Displays static application metadata. No IPC required. */
export function AboutApp(): React.JSX.Element {
  return (
    <div className="flex h-screen items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-4 text-center p-8">
        <img
          src="../../assets/app.icns"
          alt="moVoice logo"
          className="w-24 h-24 rounded-2xl"
        />
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">moVoice</h1>
          <p className="text-sm text-muted-foreground">Version 1.0.0</p>
        </div>
        <p className="text-sm text-muted-foreground">By Vladyslav Lubenskyi</p>
        <p className="text-xs text-muted-foreground/60">Powered by MōBrowser</p>
      </div>
    </div>
  );
}
