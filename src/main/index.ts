import { app } from '@mobrowser/api';
import { Application } from './Application';

const application = new Application();

application.initialize().catch((err: unknown) => {
  console.error('Fatal startup error:', err);
  const message = err instanceof Error ? err.message : String(err);
  app.showMessageDialog({
    title: 'moVoice failed to start',
    message,
    buttons: [{ label: 'Quit', type: 'primary' }],
  }).finally(() => app.quit());
});
