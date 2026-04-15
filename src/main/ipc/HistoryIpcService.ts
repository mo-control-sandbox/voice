import type { HistoryService } from '../gen/ipc_service';
import type { SessionListResponse, SessionIdRequest } from '../gen/history';
import type { StringResponse } from '../gen/error';
import type { Empty } from '../gen/google/protobuf/empty';
import type { HistoryStore } from '../services/HistoryStore';
import type { SessionFileManager } from '../services/SessionFileManager';
import type { SessionRecord } from '../../shared/types';

/** Maps a domain SessionRecord to its proto representation. */
function toProto(session: SessionRecord) {
  return {
    id: session.id,
    timestamp: session.timestamp,
    transcriptionText: session.transcriptionText,
    audioPath: session.audioPath ?? '',
    transcriptPath: session.transcriptPath ?? '',
    modelId: session.modelId,
    language: session.language ?? '',
    detectedLanguage: session.detectedLanguage ?? '',
    audioDurationSeconds: session.audioDurationSeconds,
    transcriptionDurationMs: session.transcriptionDurationMs,
    targetAppName: session.targetAppName,
    audioSaved: session.audioSaved,
    transcriptSaved: session.transcriptSaved,
  };
}

/**
 * IPC service that exposes session history operations to the renderer process.
 * Delegates all persistence to HistoryStore and file-path resolution to SessionFileManager.
 */
export class HistoryIpcService implements HistoryService {
  constructor(
    private readonly historyStore: HistoryStore,
    private readonly sessionFileManager: SessionFileManager,
  ) {}

  GetSessions(_request: Empty): Promise<SessionListResponse> {
    const sessions = this.historyStore.getSessions().map(toProto);
    return Promise.resolve({ sessions });
  }

  async DeleteSession(request: SessionIdRequest): Promise<Empty> {
    await this.historyStore.deleteSession(request.sessionId);
    return {};
  }

  RevealAudioFile(request: SessionIdRequest): Promise<Empty> {
    this.historyStore.revealAudioFile(request.sessionId);
    return Promise.resolve({});
  }

  RevealTranscriptFile(request: SessionIdRequest): Promise<Empty> {
    this.historyStore.revealTranscriptFile(request.sessionId);
    return Promise.resolve({});
  }

  GetAudioUrl(request: SessionIdRequest): Promise<StringResponse> {
    const url = this.sessionFileManager.getAudioFileUrl(request.sessionId);
    return Promise.resolve({ value: url });
  }
}
