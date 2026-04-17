import type { RecordingSignalSnapshotProto } from '../gen/main_signal';

/** Symbol tag used to identify objects registered with ReverseIpcBridge. */
export const signalServiceTag = Symbol('signalService');

/** Handler for recording state changes pushed from main. */
export interface RecordingSignalService {
  /** Called whenever the recording revision increments (any state transition). */
  onRecordingChanged(snapshot: RecordingSignalSnapshotProto): Promise<void>;
}

/** Handler for history revision changes. */
export interface HistorySignalService {
  /** Called whenever the main-side history revision increments. */
  onHistoryRevisionChanged(revision: number): Promise<void>;
}

/** Union of all optional signal handler methods. */
type AnySignalService = Partial<RecordingSignalService & HistorySignalService>;

/** A service object tagged for registration with ReverseIpcBridge. */
export type SignalServiceInstance = AnySignalService & { readonly [signalServiceTag]: true };

/**
 * Tags a RecordingSignalService implementation for registration with ReverseIpcBridge.
 * Mirrors the main-side pattern: RecordingService(impl) → impl & ServiceInstance.
 */
export function RecordingSignalService(
  impl: RecordingSignalService,
): RecordingSignalService & SignalServiceInstance {
  return Object.assign(impl, { [signalServiceTag]: true as const });
}

/**
 * Tags a HistorySignalService implementation for registration with ReverseIpcBridge.
 * Mirrors the main-side pattern: HistoryService(impl) → impl & ServiceInstance.
 */
export function HistorySignalService(
  impl: HistorySignalService,
): HistorySignalService & SignalServiceInstance {
  return Object.assign(impl, { [signalServiceTag]: true as const });
}
