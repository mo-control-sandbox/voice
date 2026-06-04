import { desktop, ipc } from '@mobrowser/api';
import { DesktopServiceDescriptor, type DesktopService as DesktopServiceInterface } from '../gen/ipc_service';
import type { OpenUrlRequest } from '../gen/desktop';

/**
 * Registers the Desktop IPC service in the main process.
 */
export function registerDesktopIpc(): void {
  ipc.registerService(DesktopServiceDescriptor, new DesktopService());
}

class DesktopService implements DesktopServiceInterface {
  /**
   * Opens the given URL in the system default browser.
   */
  OpenUrl(request: OpenUrlRequest) {
    desktop.openUrl(request.url);
    return Promise.resolve({});
  }
}
