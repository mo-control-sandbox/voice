// Internal bridge to the MōBrowser host's IPC channel injected into the window.
interface MoBrowserBridge {
  invoke(cmd: string, ...args: unknown[]): unknown
}

declare global {
  interface Window {
    readonly __MOBROWSER__?: MoBrowserBridge
  }
}

function isIpcSupported(): boolean {
  return typeof window.__MOBROWSER__ !== 'undefined';
}

export function invoke(cmd: string, ...args: unknown[]): unknown {
  if (isIpcSupported()) {
    return window.__MOBROWSER__?.invoke(cmd, ...args);
  }
  return undefined;
}
