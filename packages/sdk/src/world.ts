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

export function safeAssetPath(path: unknown): path is string {
  return typeof path === 'string' && path.length > 0 && path.length <= 1024 && !/[%\\:?#\u0000-\u001f]/.test(path) && !path.startsWith('/') && path.split('/').every(part=>part.length>0&&part!=='.'&&part!=='..');
}
export function validateWorldMetadata(metadata: WorldMetadata, runtimeVersion: string): boolean {
  const semver = (v: string) => /^\d+\.\d+\.\d+$/.test(v) && v.length <= 32;
  if (!metadata || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(metadata.id) || metadata.sdkVersion !== 1 || !semver(metadata.version) || !semver(metadata.minimumAgentWorldsVersion) || !semver(runtimeVersion)
      || !metadata.name || metadata.name.length>100 || !metadata.description || metadata.description.length>1000 || !safeAssetPath(metadata.icon) || !safeAssetPath(metadata.entrypoint) || !Array.isArray(metadata.assets) || metadata.assets.length>256 || new Set(metadata.assets).size!==metadata.assets.length || !metadata.assets.every(safeAssetPath)) return false;
  const current=runtimeVersion.split('.').map(Number),minimum=metadata.minimumAgentWorldsVersion.split('.').map(Number);
  for(let i=0;i<3;i++){if(current[i]!==minimum[i])return current[i]>minimum[i];}return true;
}
