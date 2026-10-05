import type { ClientMessage } from '../../packages/sdk/src/protocol.ts';
import type { Transport } from '../../packages/core/src/client.ts';
export interface WebKitWindow extends Window {
  webkit?: { messageHandlers?: { locusScreen?: { postMessage(message: ClientMessage): void } } };
  locusAgentWorld?: { receive(message: unknown): void };
}
/** Only this file knows the WebKit convention. No production demo fallback. */
export function webKitTransport(window: WebKitWindow): Transport {
  const bridge = window.webkit?.messageHandlers?.locusScreen;
  if (!bridge) throw new Error('Open this installed world from Locus. A native connection is required.');
  return {
    send(message) { bridge.postMessage(message); },
    subscribe(receive) {
      const endpoint = { receive }; window.locusAgentWorld = endpoint;
      return () => { if (window.locusAgentWorld === endpoint) delete window.locusAgentWorld; };
    },
    onDisconnect(callback) { window.addEventListener('pagehide',callback,{once:true}); return () => window.removeEventListener('pagehide',callback); },
  };
}
