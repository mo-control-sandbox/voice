import { env } from '@huggingface/transformers';
import { OPFSModelCache } from '../../services/OPFSModelCache';

/**
 * Configures Transformers.js to read pre-downloaded model files from OPFS.
 */
export function configureTransformersWorkerEnvironment(): void {
  env.useBrowserCache = false;
  env.useCustomCache = true;
  env.customCache = new OPFSModelCache();
}

