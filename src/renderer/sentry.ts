import * as Sentry from '@sentry/react';
import { ipc } from './gen/ipc';

declare const __SENTRY_DSN__: string;

const SENTRY_DSN = __SENTRY_DSN__;

export async function initializeSentry(): Promise<void> {
  if (SENTRY_DSN === '' || import.meta.env.DEV) {
    return;
  }

  const metadata = await ipc.applicationMetadata.GetApplicationMetadata({});

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: 'production',
    release: `${metadata.name}@${metadata.version}`,
  });
  Sentry.setTag('process', 'renderer');
}
