import { app } from '@mobrowser/api';
import * as Sentry from '@sentry/node';

declare const __SENTRY_DSN__: string;

const SENTRY_DSN = __SENTRY_DSN__;

if (SENTRY_DSN !== '' && app.packaged) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: 'production',
    release: `${app.name}@${app.version}`,
    defaultIntegrations: false,
    integrations: [
      Sentry.onUncaughtExceptionIntegration(),
      Sentry.onUnhandledRejectionIntegration(),
    ],
  });
  Sentry.setTag('process', 'main');
  Sentry.captureMessage('app.launch', 'info');

  Sentry.startSession();
  Sentry.captureSession();
}
