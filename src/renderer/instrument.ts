import * as Sentry from '@sentry/react';
import { name, version } from '../../package.json';

const SENTRY_DSN = 'https://98438641f3fb15aa82986c5e12065c84@o4511693799227392.ingest.de.sentry.io/4511693822099536';
const RENDERER_INTEGRATIONS = Sentry.getDefaultIntegrations({}).filter(
  (integration) => integration.name !== 'BrowserSession',
);

Sentry.init({
  dsn: SENTRY_DSN,
  environment: import.meta.env.DEV ? 'development' : 'production',
  release: `${name}@${version}`,
  defaultIntegrations: false,
  integrations: RENDERER_INTEGRATIONS,
});
Sentry.setTag('process', 'renderer');
