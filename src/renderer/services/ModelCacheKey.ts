/**
 * Browser Cache API partition name used by RendererModelCache (download) and
 * TransformersJsWorker (inference). Both sides must reference this constant so
 * that a rename in one place is automatically reflected in the other.
 */
export const MODEL_CACHE_PARTITION = 'movoice-models';
