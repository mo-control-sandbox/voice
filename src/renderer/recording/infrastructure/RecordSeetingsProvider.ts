import { ipc } from '../../gen/ipc';

/**
 * IPC-backed provider for recording settings reads.
 */
export class RecordSeetingsProvider {
  /**
   * Returns the selected audio input device identifier.
   */
  async getAudioInputDeviceId(): Promise<string> {
    const settings = await ipc.settings.GetSettings({});
    return settings.audioInputDeviceId;
  }
}
