import type { Capability, Command, HostSnapshot, HostEvent, JSONValue, Response } from './protocol.ts';
export interface WorldMetadata {
  id: string; name: string; version: string; description: string; icon: string;
  minimumAgentWorldsVersion: string; sdkVersion: 1; entrypoint: string; assets: readonly string[];
}
export interface WorldCapabilityDeclaration { required: readonly Capability[]; optional: readonly Capability[] }
export interface Cancellation { readonly aborted: boolean; onAbort(callback: () => void): () => void }
export interface WorldStorage {
  get(key: string): JSONValue | undefined;
  set(key: string, value: JSONValue): Promise<void>;
  reset(): Promise<void>;
}
export interface WorldContext {
  bridge: { readonly capabilities: readonly Capability[]; request(command: Command, args?: Record<string, JSONValue>): Promise<Response> };
  storage: WorldStorage;
  assets: { resolve(relativePath: string): string };
  log(level: 'info' | 'warn' | 'error', message: string): void;
  cancellation: Cancellation;
  clock: { now(): number; random(): number };
}
export interface WorldFrame { now: number; delta: number }
/** Initialize once, snapshot before activate; runtime serializes lifecycle changes.
 * Snapshots may arrive while inactive. Deactivate/dispose are idempotent. A world
 * either owns its renderer loop (Local Line) OR uses render(frame), never both.
 */
export interface World {
  readonly metadata: WorldMetadata;
  readonly capabilities: WorldCapabilityDeclaration;
  initialize(context: WorldContext): Promise<void>;
  receiveHostSnapshot(snapshot: HostSnapshot): void;
  receiveHostEvent(event: HostEvent): void;
  render(frame: WorldFrame): void;
  activate(): void | Promise<void>;
  deactivate(): void | Promise<void>;
  dispose(): void | Promise<void>;
}
