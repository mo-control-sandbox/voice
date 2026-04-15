import * as fs from 'node:fs';
import * as path from 'node:path';
import type { WhisperModelSpec } from '../../shared/types';

/**
 * Provides access to the static catalog of supported Whisper models.
 * The catalog is read from `resources/models.json` once and cached.
 */
export class WhisperModelCatalog {
  private catalog: WhisperModelSpec[] | null = null;

  constructor(private readonly resourcesPath: string) {}

  /** Return all models in the catalog. */
  getAll(): WhisperModelSpec[] {
    this.catalog ??= this.load();
    return this.catalog;
  }

  /** Return the model with the given id, or `undefined` if it is not in the catalog. */
  getById(id: string): WhisperModelSpec | undefined {
    return this.getAll().find(m => m.id === id);
  }

  private load(): WhisperModelSpec[] {
    const filePath = path.join(this.resourcesPath, 'models.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as WhisperModelSpec[];
  }
}
