import { ISLAND_QUARTERS, canOpenIslandQuarters } from './islandQuarters.ts';
import type { QuartersIslandID } from './islandQuarters.ts';
import { isSailingArea, sailingHarbors, SAILING_AREA_NAMES } from './sailingArea.ts';
import type { SailingArea } from './sailingArea.ts';
import { createCaptainsQuarters } from './captainsQuarters.ts';
import { GRAND_LINE_LANDMARKS, GRAND_LINE_MAP_RADIUS, GRAND_LINE_CALM_BELT, MARY_GEOISE } from './grandLineGeography.ts';
import { LocalLineRenderer } from './world.ts';
import { SnailAlert } from './snailAlert.ts';
import { centerEntries } from './snailAlertState.ts';
import type { ActivityTab, CenterEntry } from './snailAlertState.ts';
import { unseenRecentTransfers } from './fleetActivity.ts';
import { SHIP_ASSET_TYPES, SHIP_NAMES, parseTheme } from './theme.ts';
import type { ShipAssetType } from './theme.ts';
import { STATUS_META, SECTOR_SIZE, agentSector, clampSector, parseHostMessage, searchAgents, sectorAgents } from './state.ts';
import type { Agent, Snapshot, WorldMessage } from './state.ts';
export type LocalLineIntent = WorldMessage;
export interface LocalLineUIOptions {
    send(intent: LocalLineIntent): void | Promise<void>;
    resolveAsset(path: string): string;
    now(): number;
    demo?: boolean;
    document?: Document;
    signal?: AbortSignal;
    capabilities?: () => readonly string[];
}
export interface LocalLineUI {
    receive(message: unknown, initial?: boolean): void;
    activate(): void;
    deactivate(): void;
    dispose(): void;
    notify(message: string): void;
}
/** Transport-independent Local Line UI; callers provide the shell and authoritative projection. */
export async function initializeLocalLineUI(options: LocalLineUIOptions): Promise<LocalLineUI> {
    const document = options.document ?? globalThis.document;
    const window = document.defaultView!;
    const demo = options.demo === true;
    const now = options.now;
    const lifetime = new AbortController();
    const interactionAllowed = () => options.capabilities?.().includes('agents.interact') ?? true;
    const preferencesAllowed = () => options.capabilities?.().includes('world.preferences') ?? true;
    type Events = HTMLElementEventMap & DocumentEventMap & WindowEventMap;
    function listen<K extends keyof Events>(target: EventTarget, type: K, handler: (event: Events[K]) => void, settings?: AddEventListenerOptions | boolean): void { target.addEventListener(type, handler as EventListener, { ...(typeof settings === 'boolean' ? { capture: settings } : settings), signal: lifetime.signal }); }
    const el = <T extends HTMLElement = HTMLElement>(id: string): T => { const node = document.getElementById(id); if (!node)
        throw new Error('Local Line shell missing ' + id); return node as T; };
    function resetShell(): void {
        for (const id of ['resident-list', 'activity-list', 'island-destinations', 'agent-labels', 'quarters-crew'])
            el(id).replaceChildren();
        for (const id of ['resident-preview-panel', 'fleet-activity', 'selection-note', 'graphics-fallback', 'asset-loading', 'asset-notice', 'agent-navigation'])
            el(id).hidden = true;
        el('residents-button').setAttribute('aria-expanded', 'false');
        el('snail-alert-open').setAttribute('aria-expanded', 'false');
        el('snail-alert').dataset.expanded = 'false';
        el('snail-alert').dataset.modelState = 'loading';
        el('roster-body').hidden = false;
        el('resident-preview-panel').classList.remove('collapsed');
        el('roster-toggle').setAttribute('aria-expanded', 'true');
        el('roster-toggle').textContent = '−';
        el<HTMLInputElement>('resident-search').value = '';
        el<HTMLInputElement>('quarters-search').value = '';
        el<HTMLDetailsElement>('world-settings').open = false;
        const dialog = el<HTMLDialogElement>('captains-quarters');
        if (dialog.open)
            dialog.close();
        el('quarters-workspace').hidden = false;
        el('quarters-toggle').setAttribute('aria-expanded', 'true');
        el('quarters-toggle').textContent = 'View deck';
        el('loading-indicator').hidden = false;
        el('agent-labels').hidden = false;
        el('screen-reader-status').textContent = '';
        document.querySelector('.controls')?.removeAttribute('hidden');
        document.querySelector('.coordinate-label')?.removeAttribute('hidden');
        document.body.dataset.activityCenter = 'false';
    }
    resetShell();
    el('demo-badge').hidden = !demo;
    document.body.dataset.demo = String(demo);
    document.body.dataset.nativeChrome = String(!demo);
    const seenTransfers = new Set<string>();
    const activityButtons = new Map<string, HTMLButtonElement>();
    const rosterCards = new Map<string, {
        element: HTMLDivElement;
        button: HTMLButtonElement;
        picker: HTMLSelectElement;
    }>();
    let pendingFocusAgentID: string | undefined;
    let snapshot: Snapshot = { version: 1, type: 'snapshot', agents: [], theme: 'grand-line', projectName: '' };
    let world: LocalLineRenderer | undefined;
    let sector = 0;
    let nativeVisible = false;
    let loadedTheme: string | undefined;
    let sailingArea: SailingArea = 'whole';
    const fleetSize = () => Math.min(SECTOR_SIZE, sailingHarbors(sailingArea).length);
    let navigationMode: 'orbit' | 'pan' = 'orbit';
    let loadingTheme: string | undefined;
    let noteTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let activityTab: ActivityTab = 'attention';
    let standaloneResidentsOpen = false;
    let lastPlacements = '';
    const knownPlacements = new Map<string, {
        agentID: string;
        ship: string;
        home: string;
    }>();
    const snailAlert = new SnailAlert(el('snail-alert'), toggleActivityCenter, options.resolveAsset, now);
    const quarters = createCaptainsQuarters(() => snapshot.agents, id => world?.getAgentHome(id), selectAgent, options.resolveAsset, lifetime.signal);
    const send = (message: WorldMessage): void => {
        if (disposed)
            return;
        try {
            Promise.resolve(options.send(message)).catch(error => {
                if (!disposed)
                    showNote(error instanceof Error ? error.message : 'Action unavailable');
            });
        }
        catch {
            if (!disposed)
                showNote('Connection unavailable');
        }
    };
    const announce = (message: string): void => { el('screen-reader-status').textContent = message; };
    function showNote(message: string): void {
        const note = el('selection-note');
        note.textContent = message;
        note.hidden = false;
        if (noteTimer)
            clearTimeout(noteTimer);
        noteTimer = setTimeout(() => { note.hidden = true; }, 5000);
    }
    function applyActivity(): void {
        if (!world)
            return;
        const fresh = loadedTheme === snapshot.theme ? unseenRecentTransfers(snapshot.transfers ?? [], seenTransfers, now() / 1000) : [];
        world.setActivity(snapshot.attentionRequests ?? [], fresh);
    }
    function openAttention(requestID: string): void {
        const request = snapshot.attentionRequests?.find(item => item.id === requestID);
        if (!request)
            return;
        send({ version: 1, type: 'openAttention', requestID });
    }
    function openTransfer(transferID: string): void {
        const transfer = snapshot.transfers?.find(item => item.id === transferID);
        if (!transfer)
            return;
        send({ version: 1, type: 'openTransfer', transferID });
    }
    function setActivityCenterOpen(open: boolean, focus = true): void {
        if (open && snapshot.nativeChrome) {
            send({ version: 1, type: 'openActivityCenter' });
            return;
        }
        if (open && standaloneResidentsOpen) {
            standaloneResidentsOpen = false;
            el('resident-preview-panel').hidden = true;
            el('residents-button').setAttribute('aria-expanded', 'false');
        }
        el('fleet-activity').hidden = !open;
        document.body.dataset.activityCenter = String(open);
        snailAlert.setExpanded(open);
        if (focus) {
            if (open)
                el(activityTab === 'attention' ? 'attention-tab' : 'activity-tab').focus();
            else
                snailAlert.focus();
        }
    }
    function toggleActivityCenter(): void { setActivityCenterOpen(el('fleet-activity').hidden); }
    function selectActivityTab(tab: ActivityTab, focus = false): void {
        activityTab = tab;
        renderActivity();
        if (focus)
            el(tab === 'attention' ? 'attention-tab' : 'activity-tab').focus();
    }
    function openCenterEntry(entry: CenterEntry): void {
        if (entry.target.kind === 'request')
            openAttention(entry.target.id);
        else if (entry.target.kind === 'transfer')
            openTransfer(entry.target.id);
        else
            selectAgent(entry.target.id);
    }
    function renderActivity(): void {
        const requests = snapshot.attentionRequests ?? [], transfers = snapshot.transfers ?? [];
        const attention = centerEntries(snapshot.agents, requests, transfers, 'attention');
        const activity = centerEntries(snapshot.agents, requests, transfers, 'activity');
        const working = snapshot.agents.filter(agent => agent.status === 'working').length;
        snailAlert.update(attention.length, working, demo);
        el<HTMLButtonElement>('new-agent').disabled = snapshot.canCreateAgent !== true || !interactionAllowed();
        el('new-agent').title = !interactionAllowed() ? 'Locus has not granted agent interaction.' : snapshot.canCreateAgent ? 'Create an agent in this world' : 'Agent creation is unavailable in this world';
        el('shared-chat').textContent = 'Crew Chat';
        el('agent-controls-title').textContent = 'Captain’s Quarters';
        el('quarters-open').hidden = !demo;
        renderIslandSettings();
        for (const id of ['shared-chat', 'agent-controls', 'quarters-open', 'previous-agent', 'next-agent', 'clear-agent']) {
            const node = el<HTMLButtonElement>(id);
            node.disabled = !interactionAllowed();
            node.title = node.disabled ? 'Locus has not granted agent interaction.' : '';
        }
        for (const id of ['sailing-area', 'island-quarters-enabled', 'reset-world-settings']) {
            const node = el<HTMLInputElement>(id);
            node.disabled = !preferencesAllowed();
            node.title = node.disabled ? 'Locus has not granted world preferences.' : '';
        }
        snailAlert.setActionEnabled(!snapshot.nativeChrome || interactionAllowed());
        const selected = snapshot.agents.find(agent => agent.id === snapshot.selectedAgentID);
        el('agent-controls-name').textContent = selected?.name ?? ('Choose a captain or manage your fleet');
        el('attention-count').textContent = String(attention.length);
        el('activity-count').textContent = String(activity.length);
        el('activity-working').textContent = String(working);
        el('activity-waiting').textContent = String(snapshot.agents.filter(agent => agent.status === 'idle').length);
        el('activity-connection').textContent = demo ? 'Mock' : 'Live';
        const centerTitle = 'Activity Center';
        el('activity-title').textContent = centerTitle;
        el('activity-close').setAttribute('aria-label', `Close ${centerTitle}`);
        el('activity-eyebrow').textContent = 'THE CREW’S COMMUNICATIONS';
        el('activity-working-label').textContent = 'working';
        el('activity-waiting-label').textContent = 'available';
        el('activity-sound-label').textContent = 'Pururururu…';
        document.querySelector('.activity-overview')!.setAttribute('aria-label', 'Crew status');
        document.querySelector('.activity-tabs')!.setAttribute('aria-label', `${centerTitle} view`);
        el('activity-caption').textContent = demo ? `Sample ${'crew'} activity. No tasks are running.` : 'Your crew, on the same wavelength.';
        el('activity-footer-label').textContent = demo ? 'DEMO FREQUENCY' : 'DEN DEN NETWORK';
        for (const tab of ['attention', 'activity'] as const) {
            el(`${tab}-tab`).setAttribute('aria-selected', String(tab === activityTab));
            el(`${tab}-tab`).tabIndex = tab === activityTab ? 0 : -1;
        }
        el('activity-content').setAttribute('aria-labelledby', `${activityTab}-tab`);
        const entries = activityTab === 'attention' ? attention : activity;
        const list = el('activity-list');
        const entryIDs = new Set(entries.map(entry => entry.id));
        for (const [id, button] of activityButtons)
            if (!entryIDs.has(id)) {
                button.remove();
                activityButtons.delete(id);
            }
        const icons: Record<CenterEntry['kind'], string> = { approval: '!', input: '?', handoff: '⇄', artifact: '◇', idle: '⚓', working: '≈', queued: '◷', completed: '✓', failed: '!', needs_attention: '!' };
        entries.forEach((entry, index) => {
            let button = activityButtons.get(entry.id);
            if (!button) {
                button = document.createElement('button');
                button.type = 'button';
                button.className = 'activity-item';
                const icon = document.createElement('span');
                icon.className = 'activity-item-icon';
                icon.setAttribute('aria-hidden', 'true');
                const content = document.createElement('span');
                content.className = 'activity-item-content';
                const meta = document.createElement('span');
                meta.className = 'activity-item-meta';
                const label = document.createElement('span');
                label.className = 'activity-item-label';
                const time = document.createElement('time');
                time.className = 'activity-item-time';
                meta.append(label, time);
                const title = document.createElement('strong');
                title.className = 'activity-item-title';
                const detail = document.createElement('span');
                detail.className = 'activity-item-detail';
                content.append(meta, title, detail);
                const arrow = document.createElement('span');
                arrow.className = 'activity-item-arrow';
                arrow.textContent = '↗';
                arrow.setAttribute('aria-hidden', 'true');
                button.append(icon, content, arrow);
                listen(button, 'click', () => openCenterEntry(entry));
                activityButtons.set(entry.id, button);
            }
            button.disabled = !interactionAllowed();
            button.title = button.disabled ? 'Locus has not granted agent interaction.' : '';
            button.dataset.kind = entry.kind;
            button.dataset.targetKind = entry.target.kind;
            button.dataset.targetId = entry.target.id;
            button.querySelector('.activity-item-icon')!.textContent = icons[entry.kind];
            button.querySelector('.activity-item-label')!.textContent = entry.label;
            button.querySelector('.activity-item-title')!.textContent = entry.title;
            button.querySelector('.activity-item-detail')!.textContent = entry.detail;
            const time = button.querySelector('time')!;
            time.hidden = entry.occurredAt === undefined;
            if (entry.occurredAt !== undefined) {
                const date = new Date(entry.occurredAt * 1000);
                time.dateTime = date.toISOString();
                time.textContent = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                time.title = date.toLocaleString();
            }
            button.setAttribute('aria-label', `${entry.label}. ${entry.title}. ${entry.detail}. Open ${entry.target.kind === 'agent' ? 'agent workspace' : entry.target.kind === 'request' ? 'request' : 'delivery'}.`);
            if (list.children[index] !== button)
                list.insertBefore(button, list.children[index] ?? null);
        });
        el('activity-empty').hidden = entries.length > 0;
        el('activity-empty-mark').textContent = activityTab === 'attention' ? '✓' : '≈';
        el('activity-empty-title').textContent = activityTab === 'attention' ? 'Nothing needs attention' : 'A quiet moment at sea';
        el('activity-empty-copy').textContent = activityTab === 'attention' ? 'Your crew has the helm. We’ll ring when they need you.' : 'Work in progress, completed voyages, and crew deliveries appear here.';
    }
    function publishResidentPlacements(): void {
        if (demo || !world || loadedTheme !== snapshot.theme)
            return;
        const validIDs = new Set(snapshot.agents.map(agent => agent.id));
        for (const id of knownPlacements.keys())
            if (!validIDs.has(id))
                knownPlacements.delete(id);
        for (const agent of snapshot.agents) {
            const appearance = world?.getAgentAppearance(agent.id);
            const ship = appearance && (SHIP_ASSET_TYPES as readonly string[]).includes(appearance) ? SHIP_NAMES[appearance as ShipAssetType] : undefined;
            const home = world?.getAgentHome(agent.id);
            if (ship && home)
                knownPlacements.set(agent.id, { agentID: agent.id, ship, home });
        }
        const visibleIDs = new Set(sectorAgents(snapshot.agents, sector, fleetSize()).map(agent => agent.id));
        const placements = [...knownPlacements.values()].sort((a, b) => Number(visibleIDs.has(b.agentID)) - Number(visibleIDs.has(a.agentID))).slice(0, 500);
        const fingerprint = JSON.stringify(placements);
        if (fingerprint === lastPlacements)
            return;
        lastPlacements = fingerprint;
        send({ version: 1, type: 'residentPlacements', placements });
    }
    function selectAgent(id: string): void {
        if (!interactionAllowed()) {
            showNote('Locus has not granted agent interaction.');
            return;
        }
        const agent = snapshot.agents.find(item => item.id === id);
        if (!agent)
            return;
        const nextSector = agentSector(snapshot.agents, id, fleetSize());
        sector = nextSector;
        snapshot = { ...snapshot, selectedAgentID: id };
        updateWorldAgents();
        world?.focusResident(id);
        applyActivity();
        renderRoster();
        send({ version: 1, type: 'selectAgent', agentID: id });
        announce(`${agent.name} selected. ${STATUS_META[agent.status].label}.`);
        if (demo)
            showNote(`${agent.name} is a demo ${'captain'}. The camera follows their ship. In Locus, Captain’s Quarters also has chats and tools.`);
    }
    function selectAdjacentAgent(direction: -1 | 1): void {
        if (!snapshot.agents.length)
            return;
        const current = snapshot.agents.findIndex(agent => agent.id === snapshot.selectedAgentID);
        const index = current < 0 ? (direction > 0 ? 0 : snapshot.agents.length - 1) : (current + direction + snapshot.agents.length) % snapshot.agents.length;
        selectAgent(snapshot.agents[index].id);
    }
    function clearAgentSelection(): void {
        if (!snapshot.selectedAgentID)
            return;
        snapshot = { ...snapshot, selectedAgentID: undefined };
        pendingFocusAgentID = undefined;
        updateWorldAgents();
        renderRoster();
        world?.resetView();
        if (!demo)
            send({ version: 1, type: 'clearSelection' });
        announce('Ship selection cleared. Camera returned to the world overview.');
    }
    function openIslandQuarters(id: QuartersIslandID): void {
        if (!interactionAllowed()) {
            showNote('Locus has not granted agent interaction.');
            return;
        }
        if (!canOpenIslandQuarters(id, snapshot.islandQuartersEnabled !== false, loadedTheme ?? snapshot.theme))
            return;
        el<HTMLDetailsElement>('world-settings').open = false;
        if (demo)
            quarters.open(id);
        send({ version: 1, type: 'openIslandQuarters', islandID: id });
        announce(`Captain’s Quarters · ${ISLAND_QUARTERS[id].name}`);
    }
    function renderIslandSettings(): void {
        const enabled = snapshot.islandQuartersEnabled !== false;
        el('world-settings').hidden = !demo;
        el<HTMLInputElement>('island-quarters-enabled').checked = enabled;
        el('island-destinations').hidden = !enabled;
        for (const button of el('island-destinations').querySelectorAll('button')) {
            button.disabled = !interactionAllowed();
            button.title = button.disabled ? 'Locus has not granted agent interaction.' : '';
        }
        world?.setIslandQuartersEnabled(enabled && interactionAllowed());
        renderNavigation();
    }
    function updateWorldAgents(): void {
        world?.setRoster(snapshot.agents.map(agent => agent.id));
        world?.setIslandQuartersEnabled(snapshot.islandQuartersEnabled !== false && interactionAllowed());
        world?.setSailingArea(sailingArea);
        world?.setShipStyles(snapshot.shipStyles ?? {});
        world?.setAgents(sectorAgents(snapshot.agents, sector, fleetSize()), snapshot.selectedAgentID);
    }
    function setAgentShipStyle(agentID: string, style: string): void {
        if (!snapshot.agents.some(a => a.id === agentID) || (style && !(SHIP_ASSET_TYPES as readonly string[]).includes(style)))
            return;
        send({ version: 1, type: 'setShipStyle', agentID, shipStyle: style ? style as ShipAssetType : null });
    }
    function renderRoster(): void {
        el('resident-count').textContent = String(snapshot.agents.length);
        el('project-name').textContent = snapshot.projectName || (demo ? 'A preview of your next workspace' : 'Select a project in Locus');
        el('project-name').title = snapshot.projectName;
        el('live-label').textContent = demo ? 'Mock Locus Host · synthetic data' : 'Connected to Locus';
        const totalSectors = Math.max(1, Math.ceil(snapshot.agents.length / fleetSize()));
        el('sector-label').textContent = `${String(sector + 1).padStart(2, '0')} / ${String(totalSectors).padStart(2, '0')}`;
        el('coordinate-sector').textContent = String(sector + 1).padStart(2, '0');
        const working = snapshot.agents.filter(agent => agent.status === 'working').length;
        const attention = snapshot.agents.filter(agent => agent.status === 'needs_attention' || agent.status === 'failed').length;
        el('agent-navigation').hidden = !snapshot.selectedAgentID;
        el('working-count').textContent = working ? `${working} agent${working === 1 ? '' : 's'} at work` : attention ? `${attention} need${attention === 1 ? 's' : ''} your attention` : 'Calm seas';
        const list = el('resident-list');
        const filtered = searchAgents(snapshot.agents, el<HTMLInputElement>('resident-search').value);
        const displayed = new Set(filtered.map(agent => agent.id));
        for (const [id, card] of rosterCards)
            if (!displayed.has(id)) {
                card.element.remove();
                rosterCards.delete(id);
            }
        const oldEmpty = list.querySelector('.search-empty');
        oldEmpty?.remove();
        filtered.forEach((agent, index) => {
            let card = rosterCards.get(agent.id);
            if (!card) {
                const element = document.createElement('div');
                element.className = 'resident-card';
                const button = document.createElement('button');
                button.className = 'resident-row';
                button.type = 'button';
                button.dataset.agentId = agent.id;
                const avatar = document.createElement('span');
                avatar.className = `resident-avatar variant-${snapshot.agents.indexOf(agent) % 4}`;
                avatar.setAttribute('aria-hidden', 'true');
                const text = document.createElement('span');
                text.className = 'resident-text';
                const name = document.createElement('span');
                name.className = 'resident-name';
                const role = document.createElement('span');
                role.className = 'resident-role';
                const state = document.createElement('span');
                state.className = 'resident-state';
                state.setAttribute('aria-hidden', 'true');
                text.append(name, role);
                button.append(avatar, text, state);
                listen(button, 'click', () => selectAgent(agent.id));
                const shipControl = document.createElement('label');
                shipControl.className = 'resident-ship-picker';
                const pickerLabel = document.createElement('span');
                pickerLabel.textContent = 'Boat';
                const picker = document.createElement('select');
                picker.setAttribute('aria-label', `Boat style for ${agent.name}`);
                const automatic = document.createElement('option');
                automatic.value = '';
                automatic.textContent = 'Automatic assignment';
                picker.append(automatic);
                for (const style of SHIP_ASSET_TYPES) {
                    const option = document.createElement('option');
                    option.value = style;
                    option.textContent = SHIP_NAMES[style];
                    picker.append(option);
                }
                listen(picker, 'change', () => setAgentShipStyle(agent.id, picker.value));
                shipControl.append(pickerLabel, picker);
                element.append(button, shipControl);
                card = { element, button, picker };
                rosterCards.set(agent.id, card);
            }
            const { button, picker } = card;
            picker.parentElement!.hidden = !demo;
            picker.disabled = !preferencesAllowed();
            picker.title = picker.disabled ? 'Locus has not granted world preferences.' : '';
            button.disabled = !interactionAllowed();
            picker.setAttribute('aria-label', `Boat style for ${agent.name}`);
            picker.value = snapshot.shipStyles?.[agent.id] ?? '';
            const avatar = button.querySelector<HTMLElement>('.resident-avatar')!;
            const appearance = world?.getAgentAppearance(agent.id);
            const ship = appearance && (SHIP_ASSET_TYPES as readonly string[]).includes(appearance) ? appearance as ShipAssetType : undefined;
            avatar.dataset.vessel = String(ship ? SHIP_ASSET_TYPES.indexOf(ship) : snapshot.agents.indexOf(agent) % 12);
            const kind = world?.getAgentKind(agent.id);
            if (kind) {
                avatar.dataset.residentKind = kind;
                button.dataset.residentKind = kind;
            }
            else {
                delete avatar.dataset.residentKind;
                delete button.dataset.residentKind;
            }
            button.querySelector('.resident-name')!.textContent = agent.name;
            const home = ship ? world?.getAgentHome(agent.id) : undefined;
            button.querySelector('.resident-role')!.textContent = ship ? `${SHIP_NAMES[ship]}${home ? ` · ${home}` : ''}` : agent.role || 'Agent';
            button.classList.toggle('selected', agent.id === snapshot.selectedAgentID);
            button.style.setProperty('--status', STATUS_META[agent.status].color);
            button.dataset.status = agent.status;
            button.setAttribute('aria-pressed', String(agent.id === snapshot.selectedAgentID));
            button.setAttribute('aria-label', `${agent.name}${ship ? ` aboard ${SHIP_NAMES[ship]}` : ''}${home ? `, home island ${home}` : ''}, ${agent.role || 'Agent'}, ${STATUS_META[agent.status].label}${agent.detail ? `. ${agent.detail}` : ''}`);
            button.title = !interactionAllowed() ? 'Locus has not granted agent interaction.' : `${agent.role || 'Agent'} · ${STATUS_META[agent.status].label}${agent.detail ? ` · ${agent.detail}` : ''}`;
            if (list.children[index] !== card.element)
                list.insertBefore(card.element, list.children[index] || null);
        });
        if (!filtered.length && snapshot.agents.length) {
            const empty = document.createElement('p');
            empty.className = 'search-empty';
            empty.textContent = `No ${'captains'} match your search.`;
            list.append(empty);
        }
        el('empty-state').hidden = snapshot.agents.length > 0;
        renderActivity();
        publishResidentPlacements();
    }
    function renderNavigation(): void {
        document.body.dataset.navigation = navigationMode;
        el('mode-orbit').setAttribute('aria-pressed', String(navigationMode === 'orbit'));
        el('mode-pan').setAttribute('aria-pressed', String(navigationMode === 'pan'));
        el('drag-hint').textContent = navigationMode === 'pan' ? 'Drag to move map' : 'Drag to rotate';
        el('world').setAttribute('aria-label', `3D ${'Local Line ocean world. Each agent has their own ship'}. Click ${'a ship'} to interact.${snapshot.islandQuartersEnabled !== false ? ' Click Elbaf, Marineford, Water 7, Wano or Drum Island to visit Captain’s Quarters. Island visits are also available in Settings.' : ''} Drag to ${navigationMode === 'pan' ? 'move the map' : 'rotate the view'}, and scroll to zoom. Use arrow keys or W A S D to move the map. Use the Residents tab to select agents with the keyboard.`);
    }
    function setNavigationMode(mode: 'orbit' | 'pan'): void {
        navigationMode = mode;
        world?.setNavigationMode(mode);
        renderNavigation();
        announce(mode === 'pan' ? 'Move map mode. Drag to move across the map. Arrow keys or W A S D also move the map.' : 'Rotate mode. Drag to rotate the view. Arrow keys or W A S D move the map.');
    }
    function renderSailingArea(): void {
        el('sailing-area-control').hidden = false;
        el<HTMLSelectElement>('sailing-area').value = sailingArea;
        const overview = sailingArea === 'whole' ? 'whole map' : SAILING_AREA_NAMES[sailingArea].toLowerCase();
        el('view-reset').setAttribute('aria-label', `Reset camera to the ${overview}`);
        el('view-reset').title = `Return to the ${overview}`;
    }
    function setSailingArea(area: SailingArea): void {
        if (sailingArea === area)
            return;
        sailingArea = area;
        snapshot = { ...snapshot, sailingArea: area };
        knownPlacements.clear();
        lastPlacements = '';
        sector = snapshot.selectedAgentID ? agentSector(snapshot.agents, snapshot.selectedAgentID, fleetSize()) : 0;
        pendingFocusAgentID = undefined;
        updateWorldAgents();
        applyActivity();
        renderSailingArea();
        renderRoster();
        world?.resetView();
        send({ version: 1, type: 'preferences', preferences: { sailingArea: area } });
        announce(`Ships now stay in the ${SAILING_AREA_NAMES[area].toLowerCase()}. Camera adjusted to match.`);
    }
    function applyThemePresentation(): void {
        snailAlert.setTheme();
        document.body.dataset.environment = 'ocean';
        renderSailingArea();
        el('world-subtitle').hidden = false;
        el('voyage-chart').hidden = false;
        document.querySelector<HTMLElement>('.roster-panel')!.hidden = !standaloneResidentsOpen;
        el('residents-button').hidden = !demo;
        el('roster-title').textContent = 'Residents';
        document.querySelector('.roster-panel')!.setAttribute('aria-label', 'Fleet manifest');
        const rosterHidden = el('roster-body').hidden;
        el('roster-toggle').setAttribute('aria-label', `${rosterHidden ? 'Expand' : 'Collapse'} ${'fleet'}`);
        el('resident-search').setAttribute('aria-label', 'Search fleet');
        el<HTMLInputElement>('resident-search').placeholder = 'Find your captain';
        el('empty-title').textContent = 'Your adventure begins here';
        el('empty-description').textContent = 'Open Residents to welcome a captain and launch their ship.';
        el('coordinate-region').textContent = 'THE AGE OF LOCAL MINDS';
        el('coordinate-unit').textContent = 'FLEET';
        el('coordinate-detail').textContent = ' · LOCAL LINE';
        el('select-hint').textContent = 'Choose a ship to open its agent';
        el('world-version').textContent = 'SET SAIL';
        el('loading-label').textContent = 'Setting sail for the Local Line';
        el('asset-notice').textContent = 'Some artwork is unavailable. Your fleet is using built-in ships.';
        el('fallback-reason').textContent = `3D graphics are unavailable on this device. Select ${'a captain in the Residents tab'} to open their conversation.`;
        renderNavigation();
        renderRoster();
    }
    function renderVoyageChart(): void {
        const chart = document.querySelector<SVGSVGElement>('#voyage-chart svg');
        if (!chart)
            return;
        const ns = 'http://www.w3.org/2000/svg';
        chart.setAttribute('aria-label', 'Island positions and relative sizes across the Local Line archipelago.');
        chart.replaceChildren();
        const span = GRAND_LINE_MAP_RADIUS * 2;
        const chartX = (x: number) => (GRAND_LINE_MAP_RADIUS - x) / span * 192;
        const chartZ = (z: number) => (z + GRAND_LINE_MAP_RADIUS) / span * 94;
        for (const sign of [-1, 1]) {
            const belt = document.createElementNS(ns, 'rect');
            belt.setAttribute('class', 'chart-belt');
            belt.setAttribute('x', '0');
            belt.setAttribute('width', '192');
            belt.setAttribute('y', String(chartZ(sign < 0 ? -GRAND_LINE_CALM_BELT.outer : GRAND_LINE_CALM_BELT.inner)));
            belt.setAttribute('height', String((GRAND_LINE_CALM_BELT.outer - GRAND_LINE_CALM_BELT.inner) / span * 94));
            chart.append(belt);
        }
        const cliffs = document.createElementNS(ns, 'path');
        cliffs.setAttribute('class', 'chart-land');
        cliffs.setAttribute('d', `M${chartX(-27)} 0h${4 / span * 192}v${chartZ(-4)}h${-4 / span * 192}zM${chartX(-27)} ${chartZ(4)}h${4 / span * 192}V94h${-4 / span * 192}z`);
        chart.append(cliffs);
        for (const island of [...GRAND_LINE_LANDMARKS, MARY_GEOISE]) {
            const port = document.createElementNS(ns, 'ellipse');
            port.setAttribute('class', 'chart-port');
            port.setAttribute('cx', String(chartX(island.x)));
            port.setAttribute('cy', String(chartZ(island.z)));
            port.setAttribute('rx', String(island.radius / span * 192));
            port.setAttribute('ry', String(island.radius / span * 94));
            const title = document.createElementNS(ns, 'title');
            title.textContent = island.name;
            port.append(title);
            chart.append(port);
        }
    }
    renderVoyageChart();
    function assetProgress(completed: number, total: number): void {
        el('asset-loading').hidden = completed >= total;
        el('asset-loading').textContent = `Preparing ${'the fleet'} · ${completed} / ${total}`;
    }
    function fallback(reason?: string): void {
        el('loading-indicator').hidden = true;
        el('asset-loading').hidden = true;
        el('graphics-fallback').hidden = false;
        if (reason)
            el('fallback-reason').textContent = reason;
        document.querySelector('.controls')?.setAttribute('hidden', '');
        document.querySelector('.coordinate-label')?.setAttribute('hidden', '');
        el('agent-labels').hidden = true;
    }
    async function loadScene(): Promise<void> {
        loadingTheme = 'grand-line';
        try {
            const response = await fetch(options.resolveAsset('themes/grand-line/theme.json'), { credentials: 'omit', cache: 'no-store', signal: lifetime.signal });
            if (!response.ok)
                throw new Error('Local Line configuration unavailable');
            const theme = parseTheme(await response.json());
            if (disposed)
                return;
            loadedTheme = 'grand-line';
            applyThemePresentation();
            world = new LocalLineRenderer(el<HTMLCanvasElement>('world'), theme, { onIsland: openIslandQuarters, onSelect: selectAgent, onClearSelection: clearAgentSelection, onAttention: openAttention, onTransfer: openTransfer, onAssetFailure: () => {
                    if (!disposed)
                        el('asset-notice').hidden = false;
                }, onAssetProgress: assetProgress, onGraphicsFailure: () => fallback('The graphics connection was interrupted. Reconnect to restore the world, or use the roster.') }, options.resolveAsset, now);
            world.setNavigationMode(navigationMode);
            updateWorldAgents();
            applyActivity();
            renderRoster();
            world.setVisible(nativeVisible && !document.hidden);
            el('loading-indicator').hidden = true;
        }
        catch (error) {
            if (!disposed) {
                applyThemePresentation();
                fallback(error instanceof Error ? error.message : 'Local Line unavailable');
            }
        }
        finally {
            loadingTheme = undefined;
            if (!disposed)
                applyPendingFocus();
        }
    }
    function applyPendingFocus(): void {
        if (pendingFocusAgentID && world && !loadingTheme && loadedTheme === snapshot.theme) {
            if (snapshot.selectedAgentID === pendingFocusAgentID)
                world.focusResident(pendingFocusAgentID);
            pendingFocusAgentID = undefined;
        }
    }
    function receive(message: unknown): void {
        const parsed = parseHostMessage(message);
        if (!parsed || disposed)
            return;
        if (parsed.type === 'visibility') {
            nativeVisible = parsed.visible;
            world?.setVisible(nativeVisible && !document.hidden);
            snailAlert.setVisible(nativeVisible && !document.hidden);
            return;
        }
        const projectChanged = parsed.projectName !== snapshot.projectName;
        const selectionChanged = parsed.selectedAgentID !== snapshot.selectedAgentID;
        const focusRequested = selectionChanged || parsed.focusRequest !== snapshot.focusRequest;
        const activityRequested = (parsed.activityCenterRequest ?? 0) > 0 && parsed.activityCenterRequest !== snapshot.activityCenterRequest;
        const areaChanged = sailingArea !== (parsed.sailingArea ?? 'whole');
        snapshot = parsed;
        if (areaChanged) {
            sailingArea = parsed.sailingArea ?? 'whole';
            knownPlacements.clear();
            lastPlacements = '';
            renderSailingArea();
        }
        if (projectChanged) {
            setActivityCenterOpen(false, false);
            knownPlacements.clear();
            lastPlacements = '';
        }
        if (activityRequested && !parsed.nativeChrome)
            toggleActivityCenter();
        sector = (focusRequested || areaChanged) && parsed.selectedAgentID ? agentSector(parsed.agents, parsed.selectedAgentID, fleetSize()) : clampSector(projectChanged ? 0 : sector, parsed.agents.length, fleetSize());
        updateWorldAgents();
        applyActivity();
        renderRoster();
        if (focusRequested)
            pendingFocusAgentID = parsed.selectedAgentID;
        applyPendingFocus();
    }
    listen(el('sailing-area'), 'change', () => {
        const value = el<HTMLSelectElement>('sailing-area').value;
        if (isSailingArea(value))
            setSailingArea(value);
    });
    listen(el('new-agent'), 'click', () => {
        if (snapshot.canCreateAgent)
            send({ version: 1, type: 'createAgent' });
    });
    listen(el('shared-chat'), 'click', () => {
        send({ version: 1, type: 'openSharedChat' });
    });
    listen(el('island-quarters-enabled'), 'change', event => {
        const enabled = (event.target as HTMLInputElement).checked;
        send({ version: 1, type: 'preferences', preferences: { islandQuartersEnabled: enabled } });
    });
    for (const id of Object.keys(ISLAND_QUARTERS) as QuartersIslandID[]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = ISLAND_QUARTERS[id].name;
        button.dataset.islandId = id;
        listen(button, 'click', () => openIslandQuarters(id));
        el('island-destinations').append(button);
    }
    listen(el('quarters-settings'), 'click', () => {
        el<HTMLDialogElement>('captains-quarters').close();
        el<HTMLDetailsElement>('world-settings').open = true;
        el('island-quarters-enabled').focus();
    });
    listen(el('quarters-open'), 'click', () => { quarters.open(); send({ version: 1, type: 'openAgentControls' }); });
    listen(el('agent-controls'), 'click', () => {
        if (demo)
            quarters.open();
        send({ version: 1, type: 'openAgentControls', ...(snapshot.selectedAgentID ? { agentID: snapshot.selectedAgentID } : {}) });
    });
    listen(el('activity-close'), 'click', () => setActivityCenterOpen(false));
    listen(el('attention-tab'), 'click', () => selectActivityTab('attention'));
    listen(el('activity-tab'), 'click', () => selectActivityTab('activity'));
    for (const tab of ['attention-tab', 'activity-tab'])
        listen(el(tab), 'keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
                return;
            event.preventDefault();
            selectActivityTab(event.key === 'Home' ? 'attention' : event.key === 'End' ? 'activity' : activityTab === 'attention' ? 'activity' : 'attention', true);
        });
    listen(el<HTMLInputElement>('resident-search'), 'input', renderRoster);
    listen(el('residents-button'), 'click', () => {
        standaloneResidentsOpen = !standaloneResidentsOpen;
        if (standaloneResidentsOpen)
            setActivityCenterOpen(false, false);
        el('resident-preview-panel').hidden = !standaloneResidentsOpen;
        el('residents-button').setAttribute('aria-expanded', String(standaloneResidentsOpen));
        if (standaloneResidentsOpen)
            el('resident-search').focus();
    });
    listen(el('mode-orbit'), 'click', () => setNavigationMode('orbit'));
    listen(el('mode-pan'), 'click', () => setNavigationMode('pan'));
    listen(el('previous-agent'), 'click', () => selectAdjacentAgent(-1));
    listen(el('next-agent'), 'click', () => selectAdjacentAgent(1));
    listen(el('clear-agent'), 'click', clearAgentSelection);
    listen(el('view-reset'), 'click', () => { world?.resetView(); announce(`Camera returned to the ${SAILING_AREA_NAMES[sailingArea].toLowerCase()}.`); });
    listen(el('roster-toggle'), 'click', () => {
        const body = el('roster-body'), button = el('roster-toggle');
        body.hidden = !body.hidden;
        button.textContent = body.hidden ? '+' : '−';
        button.setAttribute('aria-expanded', String(!body.hidden));
        button.setAttribute('aria-label', `${body.hidden ? 'Expand' : 'Collapse'} ${'fleet'}`);
        document.querySelector('.roster-panel')!.classList.toggle('collapsed', body.hidden);
    });
    listen(document, 'pointerdown', event => {
        if (event.target instanceof Element && !event.target.closest('#world-settings'))
            el<HTMLDetailsElement>('world-settings').open = false;
    });
    listen(document, 'keydown', event => {
        if (event.key !== 'Escape' || event.defaultPrevented || event.target instanceof HTMLSelectElement)
            return;
        if (el<HTMLDetailsElement>('world-settings').open) {
            el<HTMLDetailsElement>('world-settings').open = false;
            el('world-settings').querySelector('summary')!.focus();
            return;
        }
        if (world?.handleCreatureKey(event.key, event.repeat)) {
            event.preventDefault();
            return;
        }
        if (!el('fleet-activity').hidden)
            setActivityCenterOpen(false);
        else if (standaloneResidentsOpen) {
            standaloneResidentsOpen = false;
            el('resident-preview-panel').hidden = true;
            el('residents-button').setAttribute('aria-expanded', 'false');
            el('residents-button').focus();
        }
    });
    listen(document, 'keydown', event => {
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || !world || disposed || document.hidden)
            return;
        const target = event.target;
        if (target instanceof Element && target.closest('button, a[href], input, textarea, select, [contenteditable], [role="button"], [role="textbox"], #resident-list, #fleet-activity, #snail-alert, .world-actions'))
            return;
        if (world.handleCreatureKey(event.key, event.repeat)) {
            event.preventDefault();
            return;
        }
        const directions: Record<string, 'left' | 'right' | 'up' | 'down'> = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down' };
        const direction = directions[event.key.toLowerCase()];
        if (!direction)
            return;
        event.preventDefault();
        world.panMap(direction);
    });
    listen(document, 'visibilitychange', () => { world?.setVisible(nativeVisible && !document.hidden); snailAlert.setVisible(nativeVisible && !document.hidden); });
    listen(window, 'pagehide', dispose);
    function dispose(): void { if (disposed)
        return; disposed = true; options.signal?.removeEventListener('abort', dispose); lifetime.abort(); world?.dispose(); world = undefined; snailAlert.dispose(); quarters.dispose(); if (noteTimer)
        clearTimeout(noteTimer); rosterCards.clear(); activityButtons.clear(); knownPlacements.clear(); seenTransfers.clear(); resetShell(); }
    listen(el('reset-world-settings'), 'click', () => send({ version: 1, type: 'resetWorldPreferences' }));
    const disabledReason = 'This action is unavailable because Locus has not granted the required capability.';
    for (const id of ['new-agent', 'shared-chat', 'agent-controls']) {
        const node = el<HTMLButtonElement>(id);
        if (!interactionAllowed()) {
            node.disabled = true;
            node.title = disabledReason;
        }
    }
    for (const id of ['sailing-area', 'island-quarters-enabled', 'reset-world-settings']) {
        const node = el<HTMLInputElement>(id);
        if (!preferencesAllowed()) {
            node.disabled = true;
            node.title = disabledReason;
        }
    }
    options.signal?.addEventListener('abort', dispose, { once: true });
    if (options.signal?.aborted) {
        dispose();
        throw new Error('Local Line initialization cancelled.');
    }
    await loadScene();
    return { receive(message, initial = false) { if (initial) {
            seenTransfers.clear();
            const parsed = parseHostMessage(message);
            if (parsed?.type === 'snapshot')
                for (const t of parsed.transfers ?? [])
                    seenTransfers.add(t.id.toLowerCase());
        } receive(message); }, activate() { if (disposed)
            return; nativeVisible = true; world?.setVisible(!document.hidden); snailAlert.setVisible(!document.hidden); }, deactivate() { nativeVisible = false; world?.setVisible(false); snailAlert.setVisible(false); }, dispose, notify: showNote };
}
