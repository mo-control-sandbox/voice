import { app } from '@mobrowser/api';

export type RendererWindowKind = 'about' | 'history' | 'recording' | 'settings' | 'welcome';

const RENDERER_WINDOW_PARAM = 'window';

/**
 * Builds the root renderer URL for a specific application window.
 */
export function rendererWindowUrl(kind: RendererWindowKind): string {
  const url = new URL(app.url);
  url.searchParams.set(RENDERER_WINDOW_PARAM, kind);
  return url.href;
}
