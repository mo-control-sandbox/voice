import { OPFSModelCache } from './OPFSModelCache';
import { RendererModelCatalog } from './RendererModelCatalog';
import { RendererModelRepository } from './RendererModelRepository';
import { RendererModelStateStore } from './RendererModelStateStore';

let repositorySingleton: RendererModelRepository | null = null;

/**
 * Returns the renderer-process model repository singleton.
 */
export function getRendererModelRepository(): RendererModelRepository {
  if (repositorySingleton === null) {
    const catalog = new RendererModelCatalog();
    repositorySingleton = new RendererModelRepository(
      catalog,
      new OPFSModelCache(catalog.getDefinitions()),
      new RendererModelStateStore(),
    );
  }

  return repositorySingleton;
}
