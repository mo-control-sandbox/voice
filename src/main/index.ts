import './instrument';
import * as Sentry from '@sentry/node';
import { Application } from './Application';

void new Application().initialize().catch((err: unknown) => {
  console.error('[Application] Failed to initialize:', err);
  Sentry.captureException(err);
});
