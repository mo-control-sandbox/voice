import { app } from '@mobrowser/api';
import type { AppInfoService } from '../gen/ipc_service';
import type { AppInfoResponse } from '../gen/app_info';
import type { Empty } from '../gen/google/protobuf/empty';

/**
 * IPC service that returns static application metadata for the About window.
 */
export class AppInfoIpcService implements AppInfoService {
  GetAppInfo(_request: Empty): Promise<AppInfoResponse> {
    return Promise.resolve({
      name: app.name,
      version: app.version,
      author: app.copyright,
    });
  }
}
