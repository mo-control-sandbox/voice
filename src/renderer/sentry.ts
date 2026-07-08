import * as Sentry from '@sentry/react';

declare const __SENTRY_DSN__: string;
declare const __SENTRY_RELEASE__: string;

const SENTRY_DSN = __SENTRY_DSN__;

if (SENTRY_DSN !== '' && !import.meta.env.DEV) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: 'production',
    release: __SENTRY_RELEASE__,
  });
  Sentry.setTag('process', 'renderer');
}
