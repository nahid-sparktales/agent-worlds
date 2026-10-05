/** Agent Worlds wire protocol 2. Canonical source; Locus vendors a pinned snapshot. */
export const PROTOCOL_VERSION = 2 as const;
export const SDK_VERSION = 1 as const;
export const RUNTIME_VERSION = '0.2.0';
export const MAX_PAYLOAD_BYTES = 524288;
export const MAX_AGENTS = 500;
export const CAPABILITIES = ['agents.read', 'agents.interact', 'world.preferences'] as const;
export type Capability = typeof CAPABILITIES[number];
export const STATUSES = ['idle', 'working', 'needs_attention', 'completed', 'failed', 'queued'] as const;
export type AgentStatus = typeof STATUSES[number];
export type Agent = { id: string; name: string; role: string; status: AgentStatus };
export type Attention = { id: string; agentID: string; kind: 'approval' | 'input'; title: string };
export type Transfer = { id: string; fromAgentID: string; toAgentID: string; kind: 'handoff' | 'artifact'; title: string; occurredAt: number };
export type JSONValue = null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue };
export type DisplayState = {
  agents: Agent[]; projectName: string; preferences: Record<string, JSONValue>;
  selectedAgentID?: string; attentionRequests: Attention[]; transfers: Transfer[];
  canCreateAgent: boolean; nativeChrome: boolean; focusRequest: number; activityCenterRequest: number;
};
export type Scope = { sessionID: string; scopeID: string };
export type Stream = Scope & { streamID: string; sequence: number };
export type Hello = { version: 2; type: 'hello'; requestID: string; protocols: number[]; runtimeVersion: string; sdkVersion: number; requiredCapabilities: Capability[]; optionalCapabilities: Capability[] };
export type Welcome = { version: 2; type: 'welcome'; requestID: string; protocol: 2; hostVersion: string; capabilities: Capability[]; sessionID: string; scopeID: string; streamID: string };
export type HostSnapshot = Stream & { version: 2; type: 'snapshot'; state: DisplayState };
/** Coalesced replacement of the bounded display projection, never a domain task command. */
export type HostEvent = Stream & { version: 2; type: 'event'; event: { type: 'projection.updated'; state: DisplayState } };
export const COMMAND_CAPABILITIES = {
  'host.snapshot': 'agents.read', 'agents.open': 'agents.interact', 'agents.create': 'agents.interact',
  'selection.clear': 'agents.interact', 'attention.open': 'agents.interact', 'transfers.open': 'agents.interact',
  'chats.openShared': 'agents.interact', 'navigation.open': 'agents.interact', 'presentation.open': 'agents.interact',
  'preferences.set': 'world.preferences', 'preferences.reset': 'world.preferences', 'placements.set': 'agents.read',
} as const satisfies Record<string, Capability>;
export type Command = keyof typeof COMMAND_CAPABILITIES;
export type Request = Scope & { version: 2; type: 'request'; requestID: string; command: Command; arguments: Record<string, JSONValue> };
export const ERROR_CODES = ['incompatible', 'denied', 'stale_session', 'invalid_request', 'not_found', 'unavailable', 'timeout', 'cancelled', 'quota'] as const;
export type ErrorCode = typeof ERROR_CODES[number];
export type WireError = { code: ErrorCode; message: string };
export type Response = Scope & { version: 2; type: 'response'; requestID: string } & ({ ok: true; result: Record<string, JSONValue> } | { ok: false; error: WireError });
export type Rejected = { version: 2; type: 'rejected'; requestID: string; error: WireError };
export type Cancel = Scope & { version: 2; type: 'cancel'; requestID: string };
export type Visibility = Scope & { version: 2; type: 'visibility'; visible: boolean };
export type Revoked = Scope & { version: 2; type: 'revoked'; reason: string };
export type ClientMessage = Hello | Request | Cancel;
export type HostMessage = Welcome | HostSnapshot | HostEvent | Response | Rejected | Visibility | Revoked;

export function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
export function exact(value: Record<string, unknown>, required: string[], optional: string[] = []): boolean {
  return required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => required.includes(key) || optional.includes(key));
}
export const isID = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export const isToken = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
export const isText = (value: unknown, max = 256): value is string => typeof value === 'string' && Array.from(value).length <= max && !/[\u0000-\u001f\u007f-\u009f]/.test(value);
export const isSequence = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
export function utf8Bytes(value: string): number { let n = 0; for (const ch of value) { const code = ch.codePointAt(0)!; n += code < 128 ? 1 : code < 2048 ? 2 : code < 65536 ? 3 : 4; } return n; }
export function boundedJSON(value: unknown, maximum = MAX_PAYLOAD_BYTES): boolean {
  const seen = new Set<object>();
  function visit(item: unknown, depth: number): boolean {
    if (depth > 8) return false;
    if (item === null || typeof item === 'boolean') return true;
    if (typeof item === 'number') return Number.isFinite(item);
    if (typeof item === 'string') return utf8Bytes(item) <= maximum;
    if (typeof item !== 'object' || !item || seen.has(item)) return false;
    seen.add(item);
    const values = Array.isArray(item) ? item : record(item) ? Object.entries(item).flatMap(([k,v]) => [k,v]) : null;
    if (!values || values.length > 2048 || !values.every(v => visit(v, depth + 1))) return false;
    seen.delete(item); return true;
  }
  try { return visit(value, 0) && utf8Bytes(JSON.stringify(value)) <= maximum; } catch { return false; }
}
const caps = (value: unknown): value is Capability[] => Array.isArray(value) && value.length <= 3 && new Set(value).size === value.length && value.every(v => CAPABILITIES.includes(v));
const scope = (value: Record<string, unknown>): boolean => isToken(value.sessionID) && isToken(value.scopeID);
const stream = (value: Record<string, unknown>): boolean => scope(value) && isToken(value.streamID) && isSequence(value.sequence);
const error = (value: unknown): boolean => record(value) && exact(value, ['code','message']) && ERROR_CODES.includes(value.code as ErrorCode) && isText(value.message, 256);
export function validPreferences(value: unknown): value is Record<string, JSONValue> {
  return record(value) && Object.keys(value).length <= 32 && Object.keys(value).every(k => /^[a-z][a-z0-9.-]{0,79}$/.test(k)) && boundedJSON(value, 32768);
}
export function validDisplayState(value: unknown): value is DisplayState {
  if (!record(value) || !exact(value, ['agents','projectName','preferences','attentionRequests','transfers','canCreateAgent','nativeChrome','focusRequest','activityCenterRequest'], ['selectedAgentID'])
      || !Array.isArray(value.agents) || value.agents.length > MAX_AGENTS || !isText(value.projectName) || !validPreferences(value.preferences)
      || typeof value.canCreateAgent !== 'boolean' || typeof value.nativeChrome !== 'boolean' || !isSequence(value.focusRequest) || !isSequence(value.activityCenterRequest)) return false;
  const ids = new Set<string>();
  for (const item of value.agents) {
    if (!record(item) || !exact(item, ['id','name','role','status']) || !isID(item.id) || ids.has(item.id.toLowerCase()) || !isText(item.name) || !isText(item.role) || !STATUSES.includes(item.status as AgentStatus)) return false;
    ids.add(item.id.toLowerCase());
  }
  const member = (id: unknown) => isID(id) && ids.has(id.toLowerCase());
  if (value.selectedAgentID !== undefined && !member(value.selectedAgentID)) return false;
  if (!Array.isArray(value.attentionRequests) || value.attentionRequests.length > 256 || !Array.isArray(value.transfers) || value.transfers.length > 128) return false;
  let seen = new Set<string>();
  for (const a of value.attentionRequests) {
    if (!record(a) || !exact(a,['id','agentID','kind','title']) || !isID(a.id) || seen.has(a.id.toLowerCase()) || !member(a.agentID) || !['approval','input'].includes(a.kind as string) || !isText(a.title)) return false;
    seen.add(a.id.toLowerCase());
  }
  seen = new Set();
  for (const t of value.transfers) {
    if (!record(t) || !exact(t,['id','fromAgentID','toAgentID','kind','title','occurredAt']) || !isID(t.id) || seen.has(t.id.toLowerCase()) || !member(t.fromAgentID) || !member(t.toAgentID) || (t.fromAgentID as string).toLowerCase() === (t.toAgentID as string).toLowerCase() || !['handoff','artifact'].includes(t.kind as string) || !isText(t.title) || typeof t.occurredAt !== 'number' || !Number.isFinite(t.occurredAt) || t.occurredAt < 0 || t.occurredAt > 253402300799) return false;
    seen.add(t.id.toLowerCase());
  }
  return true;
}
export function validArguments(command: Command, value: unknown): value is Record<string, JSONValue> {
  if (!record(value) || !boundedJSON(value, 65536)) return false;
  switch (command) {
    case 'host.snapshot': case 'agents.create': case 'selection.clear': case 'chats.openShared': case 'preferences.reset': return exact(value, []);
    case 'agents.open': return exact(value,['agentID']) && isID(value.agentID);
    case 'attention.open': return exact(value,['requestID']) && isID(value.requestID);
    case 'transfers.open': return exact(value,['transferID']) && isID(value.transferID);
    case 'navigation.open': return exact(value,['surface'],['agentID']) && ['agents','activity','calendar','board'].includes(value.surface as string) && (value.agentID === undefined || isID(value.agentID));
    case 'presentation.open': return exact(value,['presentationID']) && typeof value.presentationID === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value.presentationID);
    case 'preferences.set': return exact(value,['key','value']) && typeof value.key === 'string' && /^[a-z][a-z0-9.-]{0,79}$/.test(value.key) && boundedJSON(value.value, 32768);
    case 'placements.set': {
      if (!exact(value,['placements']) || !Array.isArray(value.placements) || value.placements.length > MAX_AGENTS) return false;
      const ids = new Set();
      return value.placements.every(p => { if (!record(p) || !exact(p,['agentID','primary','secondary']) || !isID(p.agentID) || ids.has(p.agentID.toLowerCase()) || !isText(p.primary,100) || !isText(p.secondary,100)) return false; ids.add(p.agentID.toLowerCase()); return true; });
    }
  }
}
export function parseClientMessage(value: unknown): ClientMessage | null {
  if (!boundedJSON(value) || !record(value) || value.version !== 2 || !isToken(value.requestID)) return null;
  if (value.type === 'hello') return exact(value,['version','type','requestID','protocols','runtimeVersion','sdkVersion','requiredCapabilities','optionalCapabilities']) && Array.isArray(value.protocols) && value.protocols.length > 0 && value.protocols.length <= 8 && new Set(value.protocols).size === value.protocols.length && value.protocols.every(v => Number.isSafeInteger(v) && v > 0) && typeof value.runtimeVersion === 'string' && /^\d+\.\d+\.\d+$/.test(value.runtimeVersion) && value.runtimeVersion.length <= 32 && isSequence(value.sdkVersion) && caps(value.requiredCapabilities) && caps(value.optionalCapabilities) && !value.requiredCapabilities.some(v => (value.optionalCapabilities as Capability[]).includes(v)) ? value as Hello : null;
  if (!scope(value)) return null;
  if (value.type === 'cancel') return exact(value,['version','type','requestID','sessionID','scopeID']) ? value as Cancel : null;
  return value.type === 'request' && exact(value,['version','type','requestID','sessionID','scopeID','command','arguments']) && typeof value.command === 'string' && Object.hasOwn(COMMAND_CAPABILITIES,value.command) && validArguments(value.command as Command,value.arguments) ? value as Request : null;
}
export function parseHostMessage(value: unknown): HostMessage | null {
  if (!boundedJSON(value) || !record(value) || value.version !== 2) return null;
  if (value.type === 'rejected') return exact(value,['version','type','requestID','error']) && isToken(value.requestID) && error(value.error) ? value as Rejected : null;
  if (!scope(value)) return null;
  switch (value.type) {
    case 'welcome': return exact(value,['version','type','requestID','protocol','hostVersion','capabilities','sessionID','scopeID','streamID']) && isToken(value.requestID) && value.protocol === 2 && isText(value.hostVersion,32) && caps(value.capabilities) && isToken(value.streamID) ? value as Welcome : null;
    case 'snapshot': return exact(value,['version','type','sessionID','scopeID','streamID','sequence','state']) && stream(value) && validDisplayState(value.state) ? value as HostSnapshot : null;
    case 'event': return exact(value,['version','type','sessionID','scopeID','streamID','sequence','event']) && stream(value) && record(value.event) && exact(value.event,['type','state']) && value.event.type === 'projection.updated' && validDisplayState(value.event.state) ? value as HostEvent : null;
    case 'visibility': return exact(value,['version','type','sessionID','scopeID','visible']) && typeof value.visible === 'boolean' ? value as Visibility : null;
    case 'revoked': return exact(value,['version','type','sessionID','scopeID','reason']) && isText(value.reason) ? value as Revoked : null;
    case 'response': return isToken(value.requestID) && ((value.ok === true && exact(value,['version','type','sessionID','scopeID','requestID','ok','result']) && record(value.result) && boundedJSON(value.result,32768)) || (value.ok === false && exact(value,['version','type','sessionID','scopeID','requestID','ok','error']) && error(value.error))) ? value as Response : null;
    default: return null;
  }
}
