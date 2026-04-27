import { Application } from './Application';

void new Application().initialize().catch((err: unknown) => {
  console.error('[Application] Failed to initialize:', err);
});
