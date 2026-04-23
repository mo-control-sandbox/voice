import type { ModelDefinition } from '../../types/models';
import type { TranscriptionBackend } from './TranscriptionBackend';

/**
 * Creates or reuses a TranscriptionBackend appropriate for a given model.
 *
 * Implementations own the lifecycle of any cached backend instances and must
 * release their resources when `dispose()` is called.
 */
export interface BackendFactory {
  /**
   * Returns a backend suitable for the given model definition.
   * Implementations may cache and reuse instances across calls.
   */
  createBackend(model: ModelDefinition): TranscriptionBackend;

  /**
   * Releases all cached backend resources.
   */
  dispose(): void;
}
