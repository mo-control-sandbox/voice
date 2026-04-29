/**
 * Signals the background window to pre-warm the newly activated model.
 * Called by settings and welcome after setActiveModel() completes.
 */
export function notifyModelActivated(): void {
  const channel = new BroadcastChannel('movoice:model-activated');
  channel.postMessage(null);
  channel.close();
}
