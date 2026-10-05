import type { HostSnapshot, HostEvent } from '../../sdk/src/protocol.ts';
import type { World, WorldContext } from '../../sdk/src/world.ts';
/** Serial lifecycle coordinator. Render loops belong to the chosen world. */
export class WorldRuntime {
  private world?: World;
  private initialized = false;
  private active = false;
  private generation = 0;
  private aborted = false;
  private abortListeners = new Set<() => void>();
  private latest?: HostSnapshot;
  private transition: Promise<void> = Promise.resolve();
  async load(world: World, context: Omit<WorldContext, 'cancellation'>): Promise<void> {
    await this.dispose();
    const generation = ++this.generation;
    this.aborted = false; this.world = world;
    const cancellation = { get aborted() { return self.aborted || generation !== self.generation; }, onAbort: (fn: () => void) => { if (this.aborted) fn(); else this.abortListeners.add(fn); return () => { this.abortListeners.delete(fn); }; } };
    const self = this;
    try {
      await world.initialize({ ...context, cancellation });
      if (generation !== this.generation || this.aborted) { await world.dispose(); return; }
      this.initialized = true;
      if (this.latest) world.receiveHostSnapshot(this.latest);
    } catch (error) {
      if (generation === this.generation) await this.dispose();
      else await world.dispose();
      throw error;
    }
  }
  snapshot(value: HostSnapshot): void {
    if (!this.world || this.aborted) return;
    this.latest = value;
    if (this.initialized) this.world.receiveHostSnapshot(value);
  }
  event(value: HostEvent): void {
    if (!this.world || this.aborted) return;
    this.latest = { version: 2, type: 'snapshot', sessionID: value.sessionID, scopeID: value.scopeID, streamID: value.streamID, sequence: value.sequence, state: value.event.state };
    if (this.initialized) this.world.receiveHostEvent(value);
  }
  setActive(active: boolean): Promise<void> {
    const generation = this.generation;
    this.transition = this.transition.catch(() => {}).then(async () => {
      if (!this.world || !this.initialized || !this.latest || this.aborted || generation !== this.generation || this.active === active) return;
      this.active = active;
      if (active) await this.world.activate(); else await this.world.deactivate();
    });
    return this.transition;
  }
  async dispose(): Promise<void> {
    ++this.generation; this.aborted = true;
    for (const listener of this.abortListeners) listener(); this.abortListeners.clear();
    const world = this.world; this.world = undefined; this.latest = undefined; this.initialized = false; this.active = false;
    await this.transition.catch(() => {});
    if (world) { try { await world.deactivate(); } finally { await world.dispose(); } }
  }
}
