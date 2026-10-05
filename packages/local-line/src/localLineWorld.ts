import type { DisplayState, HostEvent, HostSnapshot, JSONValue, Command } from '../../sdk/src/protocol.ts';
import type { World, WorldContext, WorldMetadata } from '../../sdk/src/world.ts';
import type { LocalLineIntent, LocalLineUI, LocalLineUIOptions } from './main.ts';
import { parseShipStyles } from './state.ts';
import type { Snapshot } from './state.ts';
import { isSailingArea } from './sailingArea.ts';
import { SHIP_ASSET_TYPES } from './theme.ts';
import { ISLAND_QUARTERS } from './islandQuarters.ts';
export const LOCAL_LINE_METADATA = {
    id: 'local-line', name: 'Local Line', version: '0.2.0',
    description: 'Your agents sail a local ocean, reflecting authorized Locus activity.',
    icon: 'assets/icon.svg', minimumAgentWorldsVersion: '0.2.0', sdkVersion: 1,
    entrypoint: 'static/world.js', assets: ['themes/grand-line/theme.json', 'assets/models/den-den-mushi.glb',
        'static/captain-deck.webp', 'static/quarters-elbaf.webp', 'static/quarters-marineford.webp',
        'static/quarters-water-seven.webp', 'static/quarters-wano.webp', 'static/quarters-drum.webp'],
} as const satisfies WorldMetadata;
/** The old grand-line slug is only an internal asset/configuration compatibility key. */
export function localLineProjection(state: DisplayState, capabilities: readonly string[]): Snapshot {
    const preferences = state.preferences;
    const selected = state.agents.find(agent => agent.id.toLowerCase() === state.selectedAgentID?.toLowerCase())?.id;
    return { version: 1, type: 'snapshot', agents: state.agents.map(agent => ({ ...agent })),
        theme: 'grand-line', projectName: state.projectName, selectedAgentID: selected,
        sailingArea: isSailingArea(preferences['sailing-area']) ? preferences['sailing-area'] : 'whole',
        shipStyles: parseShipStyles(preferences['ship-styles'] ?? {}, state.agents.map(agent => agent.id)) ?? {},
        islandQuartersEnabled: preferences['island-quarters-enabled'] !== false,
        canCreateAgent: state.canCreateAgent && capabilities.includes('agents.interact'), nativeChrome: state.nativeChrome,
        focusRequest: state.focusRequest, activityCenterRequest: state.activityCenterRequest,
        attentionRequests: state.attentionRequests.map(item => ({ ...item })), transfers: state.transfers.map(item => ({ ...item })) };
}
export type LocalLineOptions = {
    document?: Document;
    demo?: boolean;
    uiFactory?: (options: LocalLineUIOptions) => Promise<LocalLineUI>;
};
/** Babylon and its bounded alert viewport own their loops. render(frame) intentionally schedules nothing. */
export function createLocalLineWorld(options: LocalLineOptions = {}): World {
    let context: WorldContext | undefined, ui: LocalLineUI | undefined, state: DisplayState | undefined;
    const lifetime = new AbortController();
    let initialized = false, disposed = false, scope: string | undefined, unsubscribe: (() => void) | undefined;
    async function request(command: Command, args: Record<string, JSONValue> = {}): Promise<void> {
        if (disposed || !context || context.cancellation.aborted)
            throw new Error('The world is no longer connected.');
        const response = await context.bridge.request(command, args);
        if (disposed || context.cancellation.aborted)
            return;
        if (!response.ok)
            throw new Error(response.error.message);
    }
    async function preferences(key: string, value: JSONValue): Promise<void> {
        if (disposed || !context || context.cancellation.aborted)
            throw new Error('The world is no longer connected.');
        if (!context.bridge.capabilities.includes('world.preferences'))
            throw new Error('Locus has not granted world preferences.');
        await context.storage.set(key, value);
    }
    async function intent(message: LocalLineIntent): Promise<void> {
        if (!context || !state || disposed || context.cancellation.aborted)
            return;
        switch (message.type) {
            case 'ready': return;
            case 'resetWorldPreferences': {
                if (!context.bridge.capabilities.includes('world.preferences'))
                    throw new Error('Locus has not granted world preferences.');
                return context.storage.reset();
            }
            case 'selectAgent': return request('agents.open', { agentID: message.agentID });
            case 'clearSelection': return request('selection.clear');
            case 'openActivityCenter': return request('navigation.open', { surface: 'activity' });
            case 'openAgentControls': return request('navigation.open', { surface: 'agents', ...(message.agentID ? { agentID: message.agentID } : {}) });
            case 'openSharedChat': return request('chats.openShared');
            case 'createAgent': return request('agents.create');
            case 'openAttention': return request('attention.open', { requestID: message.requestID });
            case 'openTransfer': return request('transfers.open', { transferID: message.transferID });
            case 'openIslandQuarters':
                if (Object.hasOwn(ISLAND_QUARTERS, message.islandID))
                    return request('presentation.open', { presentationID: message.islandID });
                return;
            case 'residentPlacements': return request('placements.set', { placements: message.placements.map(item => ({ agentID: item.agentID, primary: item.ship, secondary: item.home })) });
            case 'setShipStyle': {
                if (!state.agents.some(agent => agent.id === message.agentID) || (message.shipStyle && !SHIP_ASSET_TYPES.includes(message.shipStyle)))
                    return;
                const styles = { ...(parseShipStyles(state.preferences['ship-styles'] ?? {}, state.agents.map(agent => agent.id)) ?? {}) };
                if (message.shipStyle)
                    styles[message.agentID] = message.shipStyle;
                else
                    delete styles[message.agentID];
                return preferences('ship-styles', styles);
            }
            case 'preferences': {
                const value = message.preferences;
                if ('sailingArea' in value && isSailingArea(value.sailingArea))
                    return preferences('sailing-area', value.sailingArea);
                if ('islandQuartersEnabled' in value)
                    return preferences('island-quarters-enabled', value.islandQuartersEnabled);
                // A single installed world has no user-facing world selection.
                return;
            }
        }
    }
    function receive(value: HostSnapshot | HostEvent, initial: boolean): void {
        if (disposed || !ui || !context || context.cancellation.aborted)
            return;
        const nextScope = `${value.sessionID}/${value.scopeID}/${value.streamID}`;
        if (scope !== undefined && scope !== nextScope) {
            const empty = localLineProjection({ ...(state ?? ('state' in value ? value.state : value.event.state)), agents: [], selectedAgentID: undefined, attentionRequests: [], transfers: [] }, context.bridge.capabilities);
            ui.receive(empty, true);
        }
        scope = nextScope;
        state = 'state' in value ? value.state : value.event.state;
        ui.receive(localLineProjection(state, context.bridge.capabilities), initial);
    }
    function dispose(): void {
        if (disposed)
            return;
        disposed = true;
        lifetime.abort();
        unsubscribe?.();
        unsubscribe = undefined;
        ui?.deactivate();
        ui?.dispose();
        ui = undefined;
        state = undefined;
        context = undefined;
    }
    return {
        metadata: LOCAL_LINE_METADATA, capabilities: { required: ['agents.read'], optional: ['agents.interact', 'world.preferences'] },
        async initialize(value) {
            if (initialized || disposed)
                throw new Error('Local Line may be initialized only once.');
            initialized = true;
            context = value;
            if (value.cancellation.aborted) {
                dispose();
                return;
            }
            unsubscribe = value.cancellation.onAbort(dispose);
            const factory = options.uiFactory ?? (await import('./main.ts')).initializeLocalLineUI;
            const mounted = await factory({ send: intent, resolveAsset: path => value.assets.resolve(path), now: () => value.clock.now(),
                demo: options.demo === true, document: options.document, signal: lifetime.signal, capabilities: () => value.bridge.capabilities });
            if (disposed || value.cancellation.aborted) {
                mounted.dispose();
                return;
            }
            ui = mounted;
            ui.deactivate();
        },
        receiveHostSnapshot(value) { receive(value, true); }, receiveHostEvent(value) { receive(value, false); },
        render() { }, activate() { if (!disposed && state)
            ui?.activate(); }, deactivate() { ui?.deactivate(); }, dispose,
    };
}
