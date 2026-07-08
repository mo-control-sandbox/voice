import * as Sentry from '@sentry/react';
import { ipc } from './gen/ipc';

declare const SENTRY_DSN: string;

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
