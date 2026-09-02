import type { SyncMessage } from '../types/messages';

const CHANNEL_NAME = 'posturesync';

let channelInstance: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel {
  if (!channelInstance) {
    channelInstance = new BroadcastChannel(CHANNEL_NAME);
  }
  return channelInstance;
}

/**
 * Send a type-safe message across browser tabs using the posturesync BroadcastChannel.
 */
export function send(message: SyncMessage): void {
  const channel = getChannel();
  channel.postMessage(message);
}

/**
 * Listen for messages on the posturesync BroadcastChannel.
 * Returns an unsubscribe cleanup function.
 */
export function onMessage(callback: (message: SyncMessage) => void): () => void {
  const channel = getChannel();
  
  const handler = (event: MessageEvent<SyncMessage>) => {
    if (event.data && typeof event.data === 'object' && 'type' in event.data) {
      callback(event.data);
    }
  };

  channel.addEventListener('message', handler);

  return () => {
    channel.removeEventListener('message', handler);
  };
}
