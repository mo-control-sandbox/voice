import { app } from '@mobrowser/api';
import * as Sentry from '@sentry/node';
import { name, version } from '../../package.json';

const SENTRY_DSN = 'https://98438641f3fb15aa82986c5e12065c84@o4511693799227392.ingest.de.sentry.io/4511693822099536';

Sentry.init({
  dsn: SENTRY_DSN,
  environment: app.packaged ? 'production' : 'development',
  release: `${name}@${version}`,
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
