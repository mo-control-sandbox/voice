import { app, ipc } from '@mobrowser/api';
import { ApplicationMetadataServiceDescriptor, type ApplicationMetadataService as ApplicationMetadataServiceInterface } from '../gen/ipc_service';

/**
 * Registers application metadata reads in the main process.
 */
export function registerApplicationMetadataIpc(): void {
  ipc.registerService(ApplicationMetadataServiceDescriptor, new ApplicationMetadataService());
}

/**
 * Provides renderer access to application metadata owned by the shell.
 */
class ApplicationMetadataService implements ApplicationMetadataServiceInterface {
  /**
   * Returns metadata from the application shell configuration.
   */
  GetApplicationMetadata() {
    return Promise.resolve({
      name: app.name,
      version: app.version,
    });
  }
}
