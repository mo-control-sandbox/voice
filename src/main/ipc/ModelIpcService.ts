import { app } from '@mobrowser/api';
import type { ModelService } from '../gen/ipc_service';
import type {
  ModelListResponse,
  ModelIdRequest,
  DownloadProgressResponse,
  PathRequest,
} from '../gen/model';
import type { StringResponse } from '../gen/error';
import type { Empty } from '../gen/google/protobuf/empty';
import type { LocalModelService } from '../services/LocalModelService';
import type { WhisperModelSpec, TranscriptionInput, TranscriptionResult } from '../../shared/types';

type WhisperLocalModelService = LocalModelService<WhisperModelSpec, TranscriptionInput, TranscriptionResult>;

/** Proto representation for the synthetic built-in macOS speech recognition entry. */
const BUILTIN_DESCRIPTION = 'Apple\'s on-device speech recognition. No download required.';

/**
 * IPC service that exposes model catalog, download lifecycle, and storage-path
 * management to the renderer process.
 * Synthesises the built-in macOS recognition entry alongside Whisper model entries.
 */
export class ModelIpcService implements ModelService {
  constructor(
    private readonly localModelService: WhisperLocalModelService,
  ) {}

  GetModels(_request: Empty): Promise<ModelListResponse> {
    void _request;
    const activeModelId = this.localModelService.getSelectedModelId();
    const whisperModels = this.localModelService.getModels().map(m => ({
      id: m.id,
      label: m.label,
      description: m.description,
      fileSizeBytes: m.fileSizeBytes,
      huggingFaceRepo: m.huggingFaceRepo,
      speedScore: m.speedScore,
      accuracyScore: m.accuracyScore,
      isMultilingual: m.isMultilingual,
      isBuiltin: false,
      isDownloaded: m.isDownloaded,
      isActive: m.isActive,
      downloadProgress: m.downloadProgress ?? -1,
    }));

    const builtinEntry = {
      id: 'builtin',
      label: 'Built-in macOS Recognition',
      description: BUILTIN_DESCRIPTION,
      fileSizeBytes: 0,
      huggingFaceRepo: '',
      speedScore: 5.0,
      accuracyScore: 3.0,
      isMultilingual: true,
      isBuiltin: true,
      isDownloaded: true,
      isActive: activeModelId === 'builtin',
      downloadProgress: -1,
    };

    return Promise.resolve({
      models: [builtinEntry, ...whisperModels],
      storagePath: this.localModelService.getStoragePath(),
    });
  }

  DownloadModel(request: ModelIdRequest): Promise<Empty> {
    // Fire-and-forget: the download runs in the background so the renderer
    // can return immediately and start polling GetModels for progress.
    void this.localModelService.downloadModel(request.modelId, () => undefined);
    return Promise.resolve({});
  }

  CancelDownload(request: ModelIdRequest): Promise<Empty> {
    this.localModelService.cancelDownload(request.modelId);
    return Promise.resolve({});
  }

  async DeleteModel(request: ModelIdRequest): Promise<Empty> {
    await this.localModelService.deleteModel(request.modelId);
    return {};
  }

  async SetActiveModel(request: ModelIdRequest): Promise<Empty> {
    await this.localModelService.setActiveModel(request.modelId);
    return {};
  }

  GetDownloadProgress(request: ModelIdRequest): Promise<DownloadProgressResponse> {
    const models = this.localModelService.getModels();
    const entry = models.find(m => m.id === request.modelId);
    const progress = entry?.downloadProgress ?? -1;
    return Promise.resolve({ progress });
  }

  async PickStoragePath(_request: Empty): Promise<StringResponse> {
    void _request;
    const result = await app.showOpenDialog({
      selectionPolicy: 'directories',
    });
    const chosen = result.paths[0] ?? '';
    return { value: chosen };
  }

  async SetStoragePath(request: PathRequest): Promise<Empty> {
    await this.localModelService.updateStoragePath(request.path);
    return {};
  }

  RevealInFinder(request: ModelIdRequest): Promise<Empty> {
    this.localModelService.revealInFinder(request.modelId);
    return Promise.resolve({});
  }
}
