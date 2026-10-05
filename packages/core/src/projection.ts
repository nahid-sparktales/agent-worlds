import type { HostSnapshot, HostEvent, DisplayState, Welcome } from '../../sdk/src/protocol.ts';
export type ProjectionResult = 'applied' | 'ignored' | 'resnapshot';
/** A disposable, scoped projection. Never persists canonical host entities. */
export class Projection {
  state?: DisplayState;
  private session?: Welcome;
  private sequence = -1;
  private needsSnapshot = true;
  connect(session: Welcome): void { this.clear(); this.session = session; }
  clear(): void { this.session = undefined; this.state = undefined; this.sequence = -1; this.needsSnapshot = true; }
  receive(message: HostSnapshot | HostEvent): ProjectionResult {
    const session = this.session;
    if (!session || message.sessionID !== session.sessionID || message.scopeID !== session.scopeID) return 'ignored';
    if (message.streamID !== session.streamID) return 'resnapshot';
    if (message.sequence <= this.sequence) return 'ignored';
    if (message.type === 'event' && (this.needsSnapshot || message.sequence !== this.sequence + 1)) {
      this.needsSnapshot = true;
      // Hide stale entities until reconciliation; no speculative event buffering.
      this.state = undefined;
      return 'resnapshot';
    }
    this.state = structuredClone(message.type === 'snapshot' ? message.state : message.event.state);
    this.sequence = message.sequence; this.needsSnapshot = false;
    return 'applied';
  }
}
