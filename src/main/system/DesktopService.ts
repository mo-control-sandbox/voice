import { desktop, ipc } from '@mobrowser/api';
import { DesktopService as createDesktopService, type DesktopService as DesktopServiceInterface } from '../gen/ipc_service';
import type { OpenUrlRequest } from '../gen/desktop';

/**
 * Registers the Desktop IPC service in the main process, delegating
 * URL-opening requests to the OS default browser via the MoBrowser desktop API.
 */
export function registerDesktopIpc(): void {
  ipc.registerService(createDesktopService(new DesktopService()));
}

class DesktopService implements DesktopServiceInterface {
  /**
   * Opens the given URL in the system default browser.
   */
  async OpenUrl(request: OpenUrlRequest) {
    desktop.openUrl(request.url);
    return {};
  }
}
