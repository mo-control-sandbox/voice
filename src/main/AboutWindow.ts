import { app, BrowserWindow } from '@mobrowser/api';

/**
 * Opens a transient About window. The window is owned by MoBrowser and
 * destroyed when the user closes it.
 */
export function showAboutWindow(): void {
  const win = new BrowserWindow({
    size: { width: 400, height: 300 },
    title: 'About moVoice',
    windowTitlebarVisible: true,
  });
  win.browser.loadUrl(new URL('about/index.html', app.url).href);
  win.show();
}
