import { COMMAND_CAPABILITIES, PROTOCOL_VERSION, RUNTIME_VERSION, SDK_VERSION, parseClientMessage, parseHostMessage } from '../../sdk/src/protocol.ts';
import type { Capability, ClientMessage, Command, HostEvent, HostSnapshot, JSONValue, Response, Welcome } from '../../sdk/src/protocol.ts';
import { Projection } from './projection.ts';
export interface Transport { send(message: ClientMessage): void; subscribe(receive: (message: unknown) => void): () => void; onDisconnect?(callback: () => void): () => void }
export interface Timers { after(milliseconds: number, callback: () => void): () => void }
export type ClientOptions = {
    required: Capability[]; optional: Capability[]; id: () => string;
    status: (status: ClientStatus, reason?: string) => void;
    snapshot: (value: HostSnapshot) => void; event: (value: HostEvent) => void;
    visibility: (visible: boolean) => void; invalidated: () => void; timers?: Timers;
};
export type ClientStatus = 'connecting' | 'connected' | 'disconnected' | 'incompatible';
const timers: Timers = { after(ms, callback) { const id = setTimeout(callback, ms); return () => clearTimeout(id); } };
export class HostClient {
  readonly projection = new Projection();
  session?: Welcome;
  private unsubscribe?: () => void;
  private disconnectSubscription?: () => void;
  private handshakeCancel?: () => void;
  private next = 0;
  private helloID = '';
  private ended = false;
  private resnapshotPending = false;
  private pending = new Map<string, { resolve: (response: Response) => void; reject: (error: Error) => void; cancelTimer: () => void }>();
  private transport: Transport;
  private options: ClientOptions;
  constructor(transport: Transport, options: ClientOptions) { this.transport = transport; this.options = options; }
  get capabilities(): readonly Capability[] { return this.session?.capabilities ?? []; }
  start(): void {
    if (this.ended || this.unsubscribe) return;
    this.unsubscribe = this.transport.subscribe(value => this.receive(value));
    this.disconnectSubscription = this.transport.onDisconnect?.(() => this.disconnect('Connection lost'));
    this.helloID = this.options.id();
    this.options.status('connecting');
    this.handshakeCancel = (this.options.timers ?? timers).after(10000, () => this.disconnect('Host handshake timed out'));
    try { this.transport.send({ version: PROTOCOL_VERSION, type: 'hello', requestID: this.helloID, protocols: [2], runtimeVersion: RUNTIME_VERSION, sdkVersion: SDK_VERSION, requiredCapabilities: this.options.required, optionalCapabilities: this.options.optional }); }
    catch { this.disconnect('Host transport unavailable'); }
  }
  request(command: Command, args: Record<string, JSONValue> = {}): Promise<Response> {
    const session = this.session;
    if (this.ended || !session) return Promise.reject(new Error('Host disconnected; explicit reconnect required'));
    if (!session.capabilities.includes(COMMAND_CAPABILITIES[command])) return Promise.reject(new Error('Capability denied'));
    if (this.pending.size >= 64) return Promise.reject(new Error('Too many pending requests'));
    const requestID = `${this.helloID}_${++this.next}`;
    const message = { version: 2 as const, type: 'request' as const, requestID, sessionID: session.sessionID, scopeID: session.scopeID, command, arguments: args };
    if (!parseClientMessage(message)) return Promise.reject(new Error('Invalid command arguments'));
    return new Promise((resolve, reject) => {
      const cancelTimer = (this.options.timers ?? timers).after(10000, () => {
        this.pending.delete(requestID);
        try { this.transport.send({ version: 2, type: 'cancel', requestID, sessionID: session.sessionID, scopeID: session.scopeID }); } catch { /* No replay: outcome may be uncertain. */ }
        reject(new Error('Request timed out; inspect authoritative host state before retrying'));
      });
      this.pending.set(requestID, { resolve, reject, cancelTimer });
      try { this.transport.send(message); } catch { this.disconnect('Host transport unavailable'); }
    });
  }
  private receive(raw: unknown): void {
    if (this.ended) return;
    const message = parseHostMessage(raw);
    if (!message) return;
    if (message.type === 'rejected' && message.requestID === this.helloID && !this.session) { this.disconnect(message.error.message, 'incompatible'); return; }
    if (message.type === 'welcome') {
      if (this.session || message.requestID !== this.helloID) return;
      if (this.options.required.some(c => !message.capabilities.includes(c)) || message.capabilities.some(c => ![...this.options.required,...this.options.optional].includes(c))) { this.disconnect('Required capabilities are unavailable', 'incompatible'); return; }
      this.handshakeCancel?.(); this.session = message; this.projection.connect(message); this.options.status('connected'); return;
    }
    const session = this.session;
    if (!session || !('sessionID' in message) || message.sessionID !== session.sessionID || message.scopeID !== session.scopeID) return;
    if (message.type === 'revoked') { this.disconnect(message.reason); return; }
    if (message.type === 'visibility') { this.options.visibility(message.visible); return; }
    if (message.type === 'response') {
      const pending = this.pending.get(message.requestID);
      if (pending) { this.pending.delete(message.requestID); pending.cancelTimer(); pending.resolve(message); }
      return;
    }
    if (message.type !== 'snapshot' && message.type !== 'event') return;
    const result = this.projection.receive(message);
    if (result === 'resnapshot') {
      this.options.invalidated();
      if (!this.resnapshotPending) {
        this.resnapshotPending = true;
        void this.request('host.snapshot').then(r => { if (!r.ok) this.disconnect('Host state could not be refreshed'); }).catch(() => this.disconnect('Host state could not be refreshed')).finally(() => { this.resnapshotPending = false; });
      }
      return;
    }
    if (result === 'applied') {
      if (message.type === 'snapshot') this.options.snapshot(message); else this.options.event(message);
    }
  }
  disconnect(reason = 'Connection closed', status: ClientStatus = 'disconnected'): void {
    if (this.ended) return;
    this.ended = true;
    this.handshakeCancel?.(); this.unsubscribe?.(); this.disconnectSubscription?.();
    this.session = undefined; this.projection.clear();
    for (const pending of this.pending.values()) { pending.cancelTimer(); pending.reject(new Error(reason)); }
    this.pending.clear(); this.options.invalidated(); this.options.status(status, reason);
  }
  dispose(): void { this.disconnect('World disposed'); }
}
