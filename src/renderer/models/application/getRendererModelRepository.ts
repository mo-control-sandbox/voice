import { OPFSModelCache } from '../OPFSModelCache';
import { RendererModelCatalog } from '../ModelDefinitionCatalog';
import { RendererModelRepository } from '../ModelRepository';
import { ModelStateStore } from '../ModelStateStore';

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
      new ModelStateStore(),
    );
  }

  return repositorySingleton;
}
