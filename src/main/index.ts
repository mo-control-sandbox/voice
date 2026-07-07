import './instrument';
import * as Sentry from '@sentry/node';
import { Application } from './Application';

const SENTRY_FLUSH_TIMEOUT_MS = 2000;

void new Application().initialize().catch(async (err: unknown) => {
  console.error('[Application] Failed to initialize:', err);
  Sentry.captureException(err);
  await Sentry.flush(SENTRY_FLUSH_TIMEOUT_MS);
});
