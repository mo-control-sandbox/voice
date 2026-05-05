import { app } from '@mobrowser/api';

export type RendererWindowKind = 'about' | 'background' | 'history' | 'settings' | 'welcome';

const RENDERER_WINDOW_PARAM = 'window';

/**
 * Builds the root renderer URL for a specific application window.
 */
export function rendererWindowUrl(kind: RendererWindowKind, hash?: string): string {
  const url = new URL(app.url);
  url.searchParams.set(RENDERER_WINDOW_PARAM, kind);
  if (hash !== undefined) {
    url.hash = hash.startsWith('#') ? hash : `#${hash}`;
  }
  return url.href;
}
