import { shipLabelDetail, shipLabelOnScreen } from './shipLabelDetail.ts';
import { canOpenIslandQuarters } from './islandQuarters.ts';
import type { QuartersIslandID } from './islandQuarters.ts';
import { stepShipCameraFollow } from './shipCameraFollow.ts';
import { fetchCompressedModel } from './assetBytes.ts';
import { createNewsCoo } from './newsCoo.ts';
import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import type { AssetContainer, InstantiatedEntries } from '@babylonjs/core/assetContainer.js';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup.js';
import '@babylonjs/core/Animations/animatable.js';
import '@babylonjs/core/Culling/ray.js';
import '@babylonjs/loaders/glTF/index.js';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import { STATUS_META, isClickGesture, labelIsUnobscured } from './state.ts';
import type { Agent, AgentTransfer, AttentionRequest, Point, ScreenPoint } from './state.ts';
import { createDenDenMushi, createCourierBoat } from './seaSignals.ts';
import { courierPose, courierRouteLength } from './fleetActivity.ts';
import { ShipEncounterState } from './shipEncounters.ts';
import type { EncounterShip } from './shipEncounters.ts';
import { createShipEncounterVisuals } from './shipEncounterVisuals.ts';
import { createIslandWorkSignals } from './islandWorkSignals.ts';
import { RESIDENT_ASSET_TYPES, SHIP_ASSET_TYPES, DEFAULT_SHIP_ASSET_TYPES, SHIP_NAMES } from './theme.ts';
import { SCENERY_ASSET_TYPES, type SceneryAssetType } from './theme.ts';
import { buildGrandLineScenery, GRAND_LINE_CREW_PLAZAS, GRAND_LINE_LANDMARKS } from './grandLineScenery.ts';
import { assignHarbors, reserveNearestHarbors, reservesWorkHarbor } from './harborAssignments.ts';
import { sailingHarbors, sailingNavigation, sailingCameraFrame } from './sailingArea.ts';
import type { SailingArea } from './sailingArea.ts';
import { placeShipLabel } from './shipLabelLayout.ts';
import { createShipWorkGlow } from './shipWorkGlow.ts';
import { createShipFallback, replaceShipFallback, createShipWake, fitShipModel } from './ships.ts';
import { createIslandCrew } from './islandCrew.ts';
import { islandCrewActivity, shipBerthHeading } from './islandBerths.ts';
import type { Theme, AssetType, ResidentAssetType, ShipAssetType, Placement } from './theme.ts';
import { createNavigation, findResidentArrival, findResidentPath, pointIsWalkable, createResidentMotion, residentAssetForID, residentSeed, resolveResidentSpacing, statusCanWander, stepResidentMotion, themeNavigation } from './residentMotion.ts';
import type { NavigationMap, ResidentMotion } from './residentMotion.ts';
type Actor = {
    root: TransformNode;
    fallback: TransformNode;
    appearance: ResidentAssetType;
    kind: "ship";
    model?: InstantiatedEntries;
    loadedAppearance?: ResidentAssetType;
    idle?: AnimationGroup;
    walk?: AnimationGroup;
    walking: boolean;
};
type Resident = {
    workGlow?: ReturnType<typeof createShipWorkGlow>;
    crew?: ReturnType<typeof createIslandCrew>;
    agent: Agent;
    actor: Actor;
    label: HTMLDivElement;
    ring: Mesh;
    wake?: TransformNode;
    home: Placement;
    motion: ResidentMotion;
    id: string;
    phase: number;
};
type Courier = {
    event: AgentTransfer;
    boat: ReturnType<typeof createCourierBoat>;
    route: Point[];
    wake: TransformNode;
    started: number;
    duration: number;
    arrivedAt?: number;
    label: HTMLDivElement;
};
type Callbacks = {
    onIsland?: (id: QuartersIslandID) => void;
    onAttention?: (requestID: string) => void;
    onTransfer?: (transferID: string) => void;
    onSelect: (id: string) => void;
    onClearSelection?: () => void;
    onAssetFailure: () => void;
    onAssetProgress: (completed: number, total: number) => void;
    onGraphicsFailure: () => void;
};
export class LocalLineRenderer {
    private engine: Engine;
    private scene!: Scene;
    private camera: ArcRotateCamera;
    private shadow: ShadowGenerator;
    private residents: Resident[] = [];
    private containers = new Map<AssetType, AssetContainer>();
    private materials = new Map<string, StandardMaterial>();
    private appearanceAssignments = new Map<string, ResidentAssetType>();
    private shipStyles = new Map<string, ShipAssetType>();
    private harborAssignments = new Map<string, number>();
    private workHarbors = new Map<string, number>();
    private sailingArea: SailingArea = 'whole';
    private overview = true;
    private seaHarbors = sailingHarbors('whole');
    private get harbors(): readonly Placement[] { return this.seaHarbors; }
    private navigation: NavigationMap;
    private islandQuartersEnabled = true;
    setIslandQuartersEnabled(enabled: boolean): void { this.islandQuartersEnabled = enabled; }
    private visible = false;
    private disposed = false;
    private lastFrame = 0;
    private lastDraw = 0;
    private elapsed = 0;
    private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    private hoveredID?: string;
    private followingID?: string;
    private focusRadius?: number;
    private selectedID?: string;
    private cleanups: (() => void)[] = [];
    private mapRoot: TransformNode;
    private labels: HTMLElement;
    private hudOverlays: HTMLElement[];
    private ocean?: ReturnType<typeof buildGrandLineScenery>;
    private navigationMode: 'orbit' | 'pan' = 'orbit';
    private attentionRequests: readonly AttentionRequest[] = [];
    private snails = new Map<string, ReturnType<typeof createDenDenMushi>>();
    private couriers = new Map<string, Courier>();
    private courierNavigation?: NavigationMap;
    private newsCoo?: ReturnType<typeof createNewsCoo>;
    private encounters = new ShipEncounterState();
    private encounterVisuals?: ReturnType<typeof createShipEncounterVisuals>;
    private islandWorkSignals?: ReturnType<typeof createIslandWorkSignals>;
    constructor(private canvas: HTMLCanvasElement, private theme: Theme, private callbacks: Callbacks, private resolveAsset: (path: string) => string, private now: () => number) {
        this.engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true, powerPreference: 'low-power', audioEngine: false });
        try {
        this.resizeRenderer();
        this.scene = new Scene(this.engine);
        this.scene.imageProcessingConfiguration.toneMappingEnabled = true;
        this.scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
        this.scene.imageProcessingConfiguration.exposure = 1.05;
        this.scene.clearColor = Color4.FromColor3(Color3.FromHexString(theme.palette.sky), 1);
        this.scene.ambientColor = new Color3(0.25, 0.34, 0.36);
        this.scene.fogMode = Scene.FOGMODE_EXP2;
        this.scene.fogColor = Color3.FromHexString(theme.palette.sky).scale(1.9);
        this.scene.fogDensity = 0.002;
        this.scene.skipPointerMovePicking = true;
        this.scene.autoClear = true;
        this.labels = document.getElementById('agent-labels')!;
        this.hudOverlays = Array.from(document.querySelectorAll<HTMLElement>('.roster-panel, .world-header, .world-footer, .coordinate-label, .voyage-chart, .view-reset, #selection-note, #asset-loading, #asset-notice, #graphics-fallback, #fleet-activity, #snail-alert, #sailing-area-control'));
        this.mapRoot = new TransformNode('local-line', this.scene);
        this.navigation = themeNavigation(theme, []);
        this.courierNavigation = createNavigation({ radius: theme.layout.radius, sailingBounds: theme.layout.sailingBounds, bodyRadius: 0.48, obstacles: theme.layout.obstacles });
        this.camera = new ArcRotateCamera('overview-camera', Math.PI / 2 - 0.3, 1.01, 33, new Vector3(0, 0.9, -0.4), this.scene);
        this.camera.lowerRadiusLimit = 14;
        this.camera.upperRadiusLimit = 46;
        this.camera.lowerBetaLimit = 0.35;
        this.camera.upperBetaLimit = 1.16;
        this.camera.minZ = 0.2;
        this.camera.maxZ = 1000;
        this.camera.wheelPrecision = 22;
        this.camera.panningSensibility = 0;
        this.camera.angularSensibilityX = 620;
        this.camera.angularSensibilityY = 620;
        this.camera.inertia = this.reducedMotion ? 0 : 0.75;
        this.camera.attachControl(canvas, true);
        this.camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');
        {
            this.camera.lowerRadiusLimit = 13;
            this.camera.upperRadiusLimit = 180;
            this.camera.wheelPrecision = 10;
            this.camera.panningSensibility = 85;
            this.camera.panningAxis.set(1, 0, 1);
            this.camera.panningDistanceLimit = 100;
            this.camera.upperBetaLimit = 1.28;
            this.resetView();
        }
        const ambient = new HemisphericLight('sky-light', new Vector3(0.2, 1, -0.4), this.scene);
        ambient.intensity = 0.75;
        ambient.diffuse = new Color3(0.85, 0.96, 1);
        ambient.groundColor = new Color3(0.42, 0.57, 0.61);
        const sun = new DirectionalLight('sunrise', new Vector3(-0.5, -1, 0.5), this.scene);
        sun.position = new Vector3(14, 24, -17);
        sun.intensity = 1.0;
        sun.diffuse = new Color3(1, 0.9, 0.74);
        {
            const seaFill = new DirectionalLight('ocean-bounce-fill', new Vector3(0.6, -0.45, -0.35), this.scene);
            seaFill.intensity = 0.32;
            seaFill.diffuse = new Color3(0.80, 0.92, 1);
        }
        this.shadow = new ShadowGenerator(Math.min(4096, this.engine.getCaps().maxTextureSize), sun);
        this.shadow.usePercentageCloserFiltering = true;
        this.shadow.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
        this.shadow.bias = 0.001;
        this.shadow.normalBias = 0.02;
        this.shadow.setDarkness(0.28);
        this.buildMap();
        this.newsCoo = createNewsCoo(this.scene, this.mapRoot);
        {
            this.encounterVisuals = createShipEncounterVisuals(this.scene, this.mapRoot);
            this.islandWorkSignals = createIslandWorkSignals(this.scene, this.mapRoot, GRAND_LINE_LANDMARKS.map((island, index) => ({ ...island, marker: GRAND_LINE_CREW_PLAZAS[index] })));
        }
        this.buildInput();
        void this.loadAssets();
        } catch(error) { this.assetRequests.abort(); for(const cleanup of this.cleanups)cleanup(); this.scene?.dispose(); this.engine.dispose(); throw error; }
    }
    private material(name: string, color: string, emission = 0, alpha = 1): StandardMaterial {
        const key = `${name}:${color}:${emission}:${alpha}`;
        const existing = this.materials.get(key);
        if (existing)
            return existing;
        const material = new StandardMaterial(name, this.scene);
        material.diffuseColor = Color3.FromHexString(color);
        material.specularColor = new Color3(0.13, 0.17, 0.17);
        material.emissiveColor = material.diffuseColor.scale(emission);
        material.alpha = alpha;
        this.materials.set(key, material);
        return material;
    }
  private box(name: string, dimensions: [number, number, number], position: [number, number, number], material: StandardMaterial, parent = this.mapRoot): Mesh {
    const mesh = MeshBuilder.CreateBox(name, { width: dimensions[0], height: dimensions[1], depth: dimensions[2] }, this.scene);
    mesh.position.set(...position);
    mesh.material = material;
    mesh.parent = parent;
    mesh.receiveShadows = true;
    mesh.isPickable = false;
    return mesh;
  }


    private ring(name: string, diameter: number, thickness: number, y: number, material: StandardMaterial, parent = this.mapRoot): Mesh {
        const mesh = MeshBuilder.CreateTorus(name, { diameter, thickness, tessellation: 80 }, this.scene);
        mesh.position.y = y;
        mesh.material = material;
        mesh.parent = parent;
        mesh.isPickable = false;
        return mesh;
    }
    private buildMap(): void { this.ocean = buildGrandLineScenery(this.scene, this.shadow, this.mapRoot, this.theme); }
    private createActor(name: string, appearance: ResidentAssetType): Actor { const root = new TransformNode(name, this.scene); const fallback = new TransformNode(name + '-fallback', this.scene); fallback.parent = root; createShipFallback(this.scene, this.shadow, fallback, appearance); for (const mesh of fallback.getChildMeshes()) {
        mesh.isPickable = true;
        mesh.metadata = { actorID: name };
    } return { root, fallback, appearance, kind: 'ship', walking: false }; }
    private attachModel(type: AssetType, parent: TransformNode, container: AssetContainer): InstantiatedEntries {
        for (const mesh of container.meshes)
            if (mesh instanceof Mesh)
                mesh.receiveShadows = true;
        const isResident = RESIDENT_ASSET_TYPES.includes(type as ResidentAssetType);
        const instance = container.instantiateModelsToScene(name => `${parent.name}-${name}`, false, { doNotInstantiate: isResident });
        const pivot = new TransformNode(`${parent.name}-model`, this.scene);
        const normalized = new TransformNode(`${parent.name}-normalized`, this.scene);
        for (const root of instance.rootNodes)
            root.parent = normalized;
        normalized.computeWorldMatrix(true);
        for (const mesh of normalized.getChildMeshes())
            mesh.computeWorldMatrix(true);
        // Normalize in isolation before applying the resident's location and facing.
        const bounds = normalized.getHierarchyBoundingVectors(true);
        const height = bounds.max.y - bounds.min.y;
        const ship = SHIP_ASSET_TYPES.includes(type as ShipAssetType);
        const shipFit = ship ? fitShipModel(type as ShipAssetType, bounds, this.theme.heights[type], this.theme.rotations[type]) : undefined;
        const scale = shipFit?.scale ?? (height > 0.0001 ? this.theme.heights[type] / height : 1);
        normalized.scaling.setAll(scale);
        if (shipFit)
            normalized.position.copyFrom(shipFit.offset);
        else
            normalized.position.set(-(bounds.min.x + bounds.max.x) / 2 * scale, -bounds.min.y * scale, -(bounds.min.z + bounds.max.z) / 2 * scale);
        normalized.parent = pivot;
        pivot.parent = parent;
        pivot.rotation.y = shipFit?.rotation ?? this.theme.rotations[type] ?? 0;
        if (shipFit)
            pivot.position.y = shipFit.waterline;
        for (const mesh of pivot.getChildMeshes()) {
            mesh.isPickable = isResident;
            mesh.metadata = { actorID: isResident ? parent.name : undefined };
            if (mesh instanceof Mesh)
                mesh.receiveShadows = true;
            this.shadow.addShadowCaster(mesh);
        }
        for (const group of instance.animationGroups)
            group.stop();
        return instance;
    }
    private upgradeActor(actor: Actor): void {
        const type = this.containers.has(actor.appearance) ? actor.appearance : actor.appearance;
        const container = this.containers.get(type);
        if (!container || actor.loadedAppearance === type)
            return;
        try {
            actor.model?.dispose();
            for (const child of [...actor.root.getChildren()])
                if (child !== actor.fallback && !child.metadata?.worldSignal)
                    child.dispose();
            actor.model = this.attachModel(type, actor.root, container);
            actor.loadedAppearance = type;
            actor.fallback.setEnabled(false);
            actor.idle = actor.model.animationGroups.find(group => /idle|standing|breath/i.test(group.name));
            actor.walk = actor.model.animationGroups.find(group => /walk|running|run/i.test(group.name));
            actor.walking = false;
            if (!this.reducedMotion)
                actor.idle?.start(true);
        }
        catch {
            this.callbacks.onAssetFailure();
        }
    }
    private readonly assetRequests = new AbortController();
    private async loadAssets(): Promise<void> {
        const entries = (Object.entries(this.theme.assets) as [
            AssetType,
            string
        ][]).sort(([a], [b]) => Number(SCENERY_ASSET_TYPES.includes(b as SceneryAssetType)) - Number(SCENERY_ASSET_TYPES.includes(a as SceneryAssetType)));
        let completed = 0;
        this.callbacks.onAssetProgress(0, entries.length);
        // Two at once keeps texture upload from monopolizing the native window.
        for (let index = 0; index < entries.length; index += 2) {
            await Promise.all(entries.slice(index, index + 2).map(async ([type, path]) => {
                try {
                    const url = this.resolveAsset(`themes/grand-line/${path}`);
                    const source = await fetchCompressedModel(url, this.assetRequests.signal);
                    if (this.disposed)
                        return;
                    const container = await LoadAssetContainerAsync(source, this.scene, { pluginExtension: '.glb', name: path.replace(/\.gz$/, '') });
                    if (this.disposed) {
                        container.dispose();
                        return;
                    }
                                for (const texture of container.textures)
                        texture.anisotropicFilteringLevel = 16;
                    this.containers.set(type, container);
                    this.lastFrame = 0;
                    if (RESIDENT_ASSET_TYPES.includes(type as ResidentAssetType))
                        for (const resident of this.residents)
                            this.upgradeActor(resident.actor);
                    if (SCENERY_ASSET_TYPES.includes(type as SceneryAssetType))
                        this.ocean?.installAsset(type as SceneryAssetType, container);
                }
                catch (error) {
                    if (!this.disposed) {
                        console.warn(`Local Line artwork unavailable: ${type}`, error instanceof Error ? error.message : 'load failed');
                        this.callbacks.onAssetFailure();
                    }
                }
                finally {
                    completed++;
                    if (!this.disposed)
                        this.callbacks.onAssetProgress(completed, entries.length);
                }
            }));
            if (this.disposed)
                break;
        }
    }
    private rebuildStations(): void { this.navigation = sailingNavigation(this.theme, this.sailingArea); }
    /** Prune private identity cache against the complete authorized roster, not a visible page. */
    setRoster(ids: readonly string[]): void {
        const valid = new Set(ids);
        for (const id of this.appearanceAssignments.keys()) {
            if (!valid.has(id)) this.appearanceAssignments.delete(id);
        }
    }
    setAgents(agents: Agent[], selectedID?: string): void {
        this.selectedID = selectedID;
        if (this.followingID && !agents.some(agent => agent.id === this.followingID))
            this.followingID = undefined;
        const existingByID = new Map(this.residents.map(resident => [resident.id, resident]));
        const sameResidents = agents.length === this.residents.length && agents.every(agent => existingByID.has(agent.id));
        if (sameResidents) {
            // Reordering profiles must not interrupt their voyage or change their berths.
            for (const agent of agents)
                existingByID.get(agent.id)!.agent = agent;
            this.assignWorkHarbors();
            for (const resident of this.residents) {
                this.syncIslandCrew(resident);
                this.updateLabel(resident);
            }
            this.updateSeaAlerts();
            return;
        }
        this.clearCouriers();
        this.encounters.clear();
        for (const snail of this.snails.values())
            snail.dispose();
        this.snails.clear();
        for (const resident of this.residents) {
            resident.workGlow?.dispose();
            resident.crew?.dispose();
            resident.actor.model?.dispose();
            resident.actor.root.dispose();
            resident.ring.dispose();
            resident.wake?.dispose();
            resident.label.remove();
        }
        const candidates: readonly ResidentAssetType[] = DEFAULT_SHIP_ASSET_TYPES;
        const appearances = candidates.filter(type => !!this.theme.assets[type]);
        if (!appearances.length)
            appearances.push('ship_thousand_sunny');
        // Balance ship identities while preserving every existing profile's appearance
        // when statuses change, profiles reorder, or another sector is visited.
        const counts = new Map(appearances.map(type => [type, 0]));
        for (const appearance of this.appearanceAssignments.values())
            if (counts.has(appearance))
                counts.set(appearance, counts.get(appearance)! + 1);
        for (const id of agents.map(agent => agent.id).sort()) {
            if (this.appearanceAssignments.has(id))
                continue;
            const minimum = Math.min(...counts.values());
            const appearance = residentAssetForID(id, appearances.filter(type => counts.get(type) === minimum));
            this.appearanceAssignments.set(id, appearance);
            counts.set(appearance, counts.get(appearance)! + 1);
        }
        this.harborAssignments = assignHarbors(agents.map(agent => agent.id), this.harborAssignments, this.harbors.length);
        const placements = agents.map((agent, index) => {
            const homeIndex = this.harborAssignments.get(agent.id) ?? index;
            return (this.harbors)[homeIndex] || this.harbors[index % this.harbors.length];
        });
        // Reserve surviving ships before placing newcomers, regardless of roster
        // order. An idle ship may be passing another island's berth.
        const occupied: Point[] = agents.flatMap((agent, index) => {
            const previous = existingByID.get(agent.id), placement = placements[index];
            return previous?.home.x === placement.x && previous.home.z === placement.z ? [previous.motion] : [];
        });
        this.residents = agents.flatMap((agent, index) => {
            const placement = placements[index];
            const previous = existingByID.get(agent.id);
            const keepsHome = previous?.home.x === placement.x && previous?.home.z === placement.z;
            const motion = keepsHome ? previous.motion : createResidentMotion(agent.id, placement);
            if (!keepsHome) {
                const arrival = findResidentArrival(placement, this.navigation, occupied);
                // An overfull custom map still exposes the agent in the roster.
                if (!arrival)
                    return [];
                motion.x = arrival.x;
                motion.z = arrival.z;
                motion.speed *= 0.65;
                motion.heading = shipBerthHeading(placement);
                occupied.push(motion);
            }
            const appearance = this.shipStyles.get(agent.id.toLowerCase()) ?? this.appearanceAssignments.get(agent.id)!;
            const actor = this.createActor(agent.id, appearance);
            // Adding a captain must not send the rest of the fleet back to port.
            actor.root.position.set(motion.x, 0.075, motion.z);
            actor.root.rotation.y = motion.heading;
            this.upgradeActor(actor);
            const label = document.createElement('div');
            label.className = 'agent-label';
            label.dataset.agentId = agent.id;
            label.dataset.appearance = actor.appearance;
            label.dataset.residentKind = actor.kind;
            label.dataset.residentStyle = 'ships';
            label.dataset.homeIsland = this.getAgentHome(agent.id) ?? '';
            label.title = `Interact with ${agent.name}`;
            label.addEventListener('pointerdown', event => {
                // Keep moving badges as the click target while the camera or layout
                // changes; the gesture must not fall through to the ocean underneath.
                if (event.button === 0 && !(event.target instanceof Element && event.target.closest('button')))
                    label.setPointerCapture(event.pointerId);
                event.stopPropagation();
            });
            label.addEventListener('click', event => { event.stopPropagation(); this.callbacks.onSelect(agent.id); });
            label.addEventListener('pointerenter', () => this.setHovered(agent.id));
            label.addEventListener('pointerleave', () => this.setHovered(undefined));
            const ring = this.ring(`resident-pad-${agent.id}`, 3.6, 0.032, 0.115, this.material('resident-pad', '#829c96', 0.1));
            ring.position.x = placement.x;
            ring.position.z = placement.z;
            const wake = createShipWake(this.scene, this.mapRoot, agent.id);
            const workGlow = createShipWorkGlow(this.scene, this.mapRoot, agent.id);
            const resident = { agent, actor, label, ring, wake, workGlow, home: placement, motion, id: agent.id, phase: index * 1.5 };
            this.labels.append(label);
            this.updateLabel(resident);
            return [resident];
        });
        this.rebuildStations();
        this.assignWorkHarbors();
        for (const resident of this.residents)
            this.updateLabel(resident);
        this.updateSeaAlerts();
        this.setHovered(undefined);
    }
    private assignWorkHarbors(): void {
        this.workHarbors = reserveNearestHarbors(this.residents.map(resident => ({ id: resident.id, status: resident.agent.status, position: resident.motion })), this.workHarbors, this.harbors, (from, to) => {
            const route = findResidentPath(from, to, this.navigation);
            if (!route)
                return Infinity;
            let length = 0, previous = from;
            for (const point of route) {
                length += Math.hypot(point.x - previous.x, point.z - previous.z);
                previous = point;
            }
            return length;
        }, this.navigation.bodyRadius * 2 + 0.08);
        // Give unreserved ships the remaining homes, preserving their current
        // positions and letting normal navigation handle any changed destination.
        const preferred = new Map(this.workHarbors);
        const used = new Set(preferred.values());
        for (const resident of this.residents) {
            const old = this.harborAssignments.get(resident.id);
            if (!preferred.has(resident.id) && old !== undefined && !used.has(old)) {
                preferred.set(resident.id, old);
                used.add(old);
            }
        }
        this.harborAssignments = assignHarbors(this.residents.map(resident => resident.id), preferred, this.harbors.length);
        for (const resident of this.residents) {
            const home = this.harbors[this.harborAssignments.get(resident.id)!];
            if (home !== resident.home) {
                resident.crew?.dispose();
                resident.crew = undefined;
                resident.home = home;
            }
            resident.label.dataset.homeIsland = this.getAgentHome(resident.id) ?? '';
        }
    }
    private updateLabel(resident: Resident): void {
        const meta = STATUS_META[resident.agent.status];
        resident.label.replaceChildren();
        const inner = document.createElement('div');
        inner.className = 'agent-label-inner';
        const name = document.createElement('span');
        name.className = 'agent-label-name';
        name.textContent = resident.agent.name;
        {
            const ship = document.createElement('span');
            ship.className = 'agent-label-ship';
            ship.textContent = SHIP_NAMES[resident.actor.appearance as ShipAssetType];
            name.append(ship);
            const port = document.createElement('span');
            port.className = 'agent-label-port';
            port.textContent = this.getAgentHome(resident.id) ?? '';
            name.append(port);
            resident.label.dataset.ship = ship.textContent ?? '';
        }
        const state = document.createElement('span');
        state.className = 'agent-label-state';
        state.textContent = meta.label;
        inner.append(name, state);
        {
            const source = document.querySelector('.snail-art-placeholder');
            if (source) {
                const snail = source.cloneNode(true) as SVGElement;
                snail.setAttribute('class', 'agent-label-communicator');
                snail.setAttribute('aria-hidden', 'true');
                inner.prepend(snail);
            }
        }
        const request = this.attentionRequests.find(item => item.agentID.toLowerCase() === resident.id.toLowerCase());
        if (request) {
            const call = document.createElement('button');
            call.type = 'button';
            call.tabIndex = -1;
            call.className = 'den-den-call';
            call.textContent = request.kind === 'approval' ? 'Ping Ping · Approval' : 'Ping Ping · Needs your input';
            call.setAttribute('aria-label', `Open ${resident.agent.name}’s ${request.kind === 'approval' ? 'approval request' : 'input request'}`);
            call.title = request.title;
            call.dataset.requestId = request.id;
            call.addEventListener('click', event => { event.stopPropagation(); this.callbacks.onAttention?.(request.id); });
            inner.append(call);
        }
        resident.label.append(inner);
        resident.label.classList.toggle('selected', resident.id === this.selectedID);
        resident.label.classList.toggle('hovered', resident.id === this.hoveredID);
        resident.label.title = `${resident.agent.name} · ${meta.label}${this.getAgentHome(resident.id) ? ` · ${this.getAgentHome(resident.id)}` : ''}`;
        resident.label.style.setProperty('--status', meta.color);
        resident.label.dataset.status = resident.agent.status;
        const selected = resident.id === this.selectedID, hovered = resident.id === this.hoveredID;
        resident.ring.material = this.material('resident-pad', selected ? '#a6f1dc' : hovered ? '#9ed7c5' : '#829c96', selected ? 0.8 : hovered ? 0.45 : 0.1);
        resident.ring.isVisible = selected || hovered;
    }
    private resizeRenderer(): void {
        // Babylon's scale is inverse: 0.5 renders two pixels per CSS pixel.
        // Reapply the cap when the window moves between displays or changes size.
        const pixelRatio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        this.engine.setHardwareScalingLevel(1 / pixelRatio);
    }
    handleCreatureKey(key: string, repeat = false): boolean { return this.ocean?.handleCreatureKey(key, repeat) ?? false; }
    private buildInput(): void {
        const listen = <K extends keyof WindowEventMap>(type: K, listener: (event: WindowEventMap[K]) => void) => { window.addEventListener(type, listener); this.cleanups.push(() => window.removeEventListener(type, listener)); };
        listen('resize', () => { this.resizeRenderer(); if (this.overview)
            this.resetView(); });
        const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
        const motionPreferenceChanged = (event: MediaQueryListEvent) => {
            this.reducedMotion = event.matches;
            this.camera.inertia = this.reducedMotion ? 0 : 0.75;
            if (this.reducedMotion) {
                this.camera.inertialAlphaOffset = 0;
                this.camera.inertialBetaOffset = 0;
                this.camera.inertialRadiusOffset = 0;
            }
            for (const resident of this.residents)
                this.setActorWalking(resident.actor, resident.motion.walking, true);
        };
        motionPreference.addEventListener('change', motionPreferenceChanged);
        this.cleanups.push(() => motionPreference.removeEventListener('change', motionPreferenceChanged));
        let pointerStart: ScreenPoint | undefined;
        let dragged = false;
        const pick = (event: PointerEvent): {
            actorID?: string;
            attentionID?: string;
            transferID?: string;
            creatureID?: string;
            islandID?: QuartersIslandID;
        } | undefined => {
            const rect = this.canvas.getBoundingClientRect();
            return this.scene.pick(event.clientX - rect.left, event.clientY - rect.top, mesh => mesh.isEnabled() && mesh.isVisible && mesh.isPickable && (typeof mesh.metadata?.actorID === 'string' || typeof mesh.metadata?.transferID === 'string' || typeof mesh.metadata?.creatureID === 'string' || canOpenIslandQuarters(mesh.metadata?.islandID, this.islandQuartersEnabled, this.theme.id)))?.pickedMesh?.metadata;
        };
        const down = (event: PointerEvent) => {
            this.overview = false;
            if (event.button === 2) {
                this.followingID = undefined;
                this.focusRadius = undefined;
            }
            if (event.button !== 0)
                return;
            pointerStart = { x: event.clientX, y: event.clientY };
            dragged = false;
            this.canvas.focus({ preventScroll: true });
        };
        const move = (event: PointerEvent) => {
            if (pointerStart) {
                dragged ||= !isClickGesture(pointerStart, { x: event.clientX, y: event.clientY });
                if (dragged) {
                    this.followingID = undefined;
                    this.focusRadius = undefined;
                    this.setHovered(undefined);
                    this.canvas.style.cursor = 'grabbing';
                }
                return;
            }
            const target = pick(event);
            this.setHovered(target?.actorID);
            if (target?.transferID || target?.attentionID || target?.creatureID || target?.islandID)
                this.canvas.style.cursor = 'pointer';
        };
        const up = (event: PointerEvent) => {
            const click = pointerStart && !dragged && isClickGesture(pointerStart, { x: event.clientX, y: event.clientY });
            pointerStart = undefined;
            dragged = false;
            const target = pick(event);
            this.setHovered(target?.actorID);
            if (click && target?.creatureID)
                this.ocean?.selectCreature(target.creatureID);
            else if (click && target?.attentionID)
                this.callbacks.onAttention?.(target.attentionID);
            else if (click && target?.transferID)
                this.callbacks.onTransfer?.(target.transferID);
            else if (click && target?.actorID)
                this.callbacks.onSelect(target.actorID);
            else if (click && target?.islandID)
                this.callbacks.onIsland?.(target.islandID);
            else if (click && !target)
                this.callbacks.onClearSelection?.();
        };
        const cancel = () => { pointerStart = undefined; dragged = false; this.setHovered(undefined); };
        const wheel = () => { this.overview = false; this.focusRadius = undefined; };
        this.canvas.addEventListener('wheel', wheel, { passive: true });
        this.cleanups.push(() => this.canvas.removeEventListener('wheel', wheel));
        this.canvas.addEventListener('pointerdown', down);
        this.canvas.addEventListener('pointermove', move);
        this.canvas.addEventListener('pointerup', up);
        this.canvas.addEventListener('pointerleave', cancel);
        this.canvas.addEventListener('pointercancel', cancel);
        listen('blur', cancel);
        this.cleanups.push(() => { this.canvas.removeEventListener('pointerdown', down); this.canvas.removeEventListener('pointermove', move); this.canvas.removeEventListener('pointerup', up); this.canvas.removeEventListener('pointerleave', cancel); this.canvas.removeEventListener('pointercancel', cancel); });
        this.engine.onContextLostObservable.add(() => this.callbacks.onGraphicsFailure());
    }
    private setHovered(id?: string): void {
        this.canvas.style.cursor = id ? 'pointer' : this.navigationMode === 'pan' ? 'move' : 'grab';
        if (id === this.hoveredID)
            return;
        this.hoveredID = id;
        for (const resident of this.residents)
            this.updateLabel(resident);
    }
    private render = (): void => {
        if (this.disposed || !this.visible || document.hidden)
            return;
        // Wall time schedules GPU redraws; the injected clock alone advances visual simulation.
        const drawNow = performance.now();
        if (drawNow - this.lastDraw < 1000 / 30 - 1) return;
        this.lastDraw = drawNow;
        const now = this.now();
        const dt = Math.max(0, Math.min((now - (this.lastFrame || now)) / 1000, 0.05));
        this.lastFrame = now;
        this.elapsed += dt;
        this.newsCoo?.update(this.elapsed, this.reducedMotion);
        this.ocean?.update(this.elapsed, this.reducedMotion);
        const rosterIDs = this.residents.map(resident => resident.id);
        const pausedIDs = new Set(this.residents.filter(resident => statusCanWander(resident.agent.status) && (resident.id === this.selectedID || resident.id === this.hoveredID)).map(resident => resident.id));
        this.encounters.updateIdle(this.encounterShips(), this.navigation, this.elapsed, this.reducedMotion, this.encounterHeldIDs());
        const destinations = this.encounters.destinations(this.encounterShips(), this.elapsed, this.reducedMotion, this.encounterHeldIDs());
        const previous = this.residents.map(resident => resident.motion);
        const proposed = this.residents.map(resident => {
            const rendezvous = destinations.get(resident.id);
            return stepResidentMotion(resident.motion, { status: rendezvous ? 'working' : resident.agent.status, home: rendezvous ?? resident.home, dt, rosterIDs, visible: this.visible, paused: pausedIDs.has(resident.id), reducedMotion: this.reducedMotion }, this.navigation);
        });
        const motions = resolveResidentSpacing(proposed, previous, this.navigation, pausedIDs);
        for (let index = 0; index < this.residents.length; index++) {
            const resident = this.residents[index];
            resident.motion = motions[index];
            resident.actor.root.position.set(resident.motion.x, 0.075, resident.motion.z);
            resident.actor.root.rotation.y = resident.motion.heading;
            {
                resident.actor.root.position.y = this.reducedMotion ? 0.025 : 0.045 + Math.sin(this.elapsed * 1.5 + resident.phase) * 0.055;
                resident.actor.root.rotation.x = this.reducedMotion ? 0 : Math.sin(this.elapsed * 1.2 + resident.phase) * 0.018;
                resident.actor.root.rotation.z = this.reducedMotion ? 0 : Math.sin(this.elapsed * 1.6 + resident.phase) * 0.027;
                if (resident.wake) {
                    resident.wake.position.set(resident.motion.x, 0.075, resident.motion.z);
                    resident.wake.rotation.y = resident.motion.heading;
                    resident.wake.setEnabled(resident.motion.walking && !this.reducedMotion);
                    resident.wake.scaling.z = 0.95 + Math.sin(this.elapsed * 2 + resident.phase) * 0.12;
                }
            }
            resident.ring.position.x = resident.motion.x;
            resident.ring.position.z = resident.motion.z;
            resident.label.dataset.behavior = resident.motion.phase;
            resident.label.dataset.walking = String(resident.motion.walking);
            resident.label.dataset.worldX = resident.motion.x.toFixed(3);
            resident.label.dataset.worldZ = resident.motion.z.toFixed(3);
            resident.label.dataset.heading = resident.motion.heading.toFixed(5);
            {
                this.syncIslandCrew(resident);
                const atBerth = Math.hypot(resident.motion.x - resident.home.x, resident.motion.z - resident.home.z) < 0.08 && !resident.motion.walking;
                const parkedHeading = shipBerthHeading(resident.home);
                const aligned = Math.abs(Math.atan2(Math.sin(resident.motion.heading - parkedHeading), Math.cos(resident.motion.heading - parkedHeading))) < 0.06;
                const docked = atBerth && aligned;
                resident.label.dataset.workGlow = String(resident.workGlow?.update(resident.agent.status, docked, resident.motion, resident.motion.heading, this.elapsed, this.reducedMotion) ?? false);
                const berthState = docked ? resident.agent.status === 'working' ? 'Working ashore' : 'Docked' : atBerth ? 'Docking' : resident.motion.intent === 'station' ? 'Heading to' : 'Sailing near';
                const home = this.getAgentHome(resident.id) ?? 'Home island';
                const portText = `${berthState} · ${home}`;
                const port = resident.label.querySelector('.agent-label-port');
                if (port && port.textContent !== portText)
                    port.textContent = portText;
                resident.label.dataset.docked = String(docked);
            }
            this.setActorWalking(resident.actor, resident.motion.walking);
        }
        this.updateSeaActivity();
        this.updateShipEncounters();
        this.updateIslandWorkSignals();
        const followed = this.residents.find(resident => resident.id === this.followingID);
        if (followed) {
            this.focusRadius = stepShipCameraFollow(this.camera, followed.motion, dt, this.reducedMotion, this.focusRadius);
        }
        this.canvas.dataset.followingAgent = followed?.id ?? '';
        this.scene.render();
        this.updateLabels();
    };
    private setActorWalking(actor: Actor, walking: boolean, force = false): void {
        if (!force && actor.walking === walking)
            return;
        actor.walking = walking;
        actor.walk?.stop();
        actor.idle?.stop();
        if (this.reducedMotion)
            return;
        if (walking && actor.walk)
            actor.walk.start(true, 0.8);
        else
            actor.idle?.start(true);
    }
    private updateLabels(): void {
        // Apply before measuring so collision placement uses the actual badge/card
        // bounds. CSS transforms alone would leave oversized invisible hit areas.
        const detail = shipLabelDetail(this.camera.radius, this.canvas.clientHeight, this.camera.fov);
        if (this.labels.dataset.detail !== detail)
            this.labels.dataset.detail = detail;
        const viewport = this.camera.viewport.toGlobal(this.engine.getRenderWidth(), this.engine.getRenderHeight());
        const scaleX = this.canvas.clientWidth / this.engine.getRenderWidth();
        const scaleY = this.canvas.clientHeight / this.engine.getRenderHeight();
        const canvasRect = this.canvas.getBoundingClientRect();
        const overlays = this.hudOverlays.filter(element => !element.hidden && element.getClientRects().length > 0).map(element => {
            const rect = element.getBoundingClientRect();
            return { left: rect.left - canvasRect.left, top: rect.top - canvasRect.top, right: rect.right - canvasRect.left, bottom: rect.bottom - canvasRect.top };
        });
        const candidates = this.residents.map(resident => {
            const projected = Vector3.Project(resident.actor.root.position.add(new Vector3(0, this.theme.heights[resident.actor.appearance] + 0.26, 0)), Matrix.IdentityReadOnly, this.scene.getTransformMatrix(), viewport);
            const x = projected.x * scaleX, y = projected.y * scaleY;
            const halfWidth = resident.label.offsetWidth / 2;
            const bounds = { left: x - halfWidth, top: y - resident.label.offsetHeight, right: x + halfWidth, bottom: y };
            const priority = resident.id === this.selectedID ? 0 : resident.id === this.hoveredID ? 1 : resident.agent.status === 'needs_attention' || resident.agent.status === 'failed' ? 2 : resident.agent.status !== 'idle' ? 3 : 4;
            return { label: resident.label, id: resident.id, projected, x, y, bounds, priority };
        });
        for (const courier of this.couriers.values()) {
            const projected = Vector3.Project(courier.boat.root.position.add(new Vector3(0, 1.7, 0)), Matrix.IdentityReadOnly, this.scene.getTransformMatrix(), viewport);
            const x = projected.x * scaleX, y = projected.y * scaleY, halfWidth = courier.label.offsetWidth / 2;
            candidates.push({ label: courier.label, id: courier.event.id, projected, x, y, bounds: { left: x - halfWidth, top: y - courier.label.offsetHeight, right: x + halfWidth, bottom: y }, priority: 3 });
        }
        candidates.sort((a, b) => a.priority - b.priority || a.projected.z - b.projected.z || a.id.localeCompare(b.id));
        const occupied = [...overlays];
        for (const { label, projected, x, y, bounds } of candidates) {
            const ship = !label.classList.contains('courier-label');
            const rect = ship ? placeShipLabel(x, y, label.offsetWidth, label.offsetHeight, this.canvas.clientWidth, this.canvas.clientHeight, occupied) : bounds;
            const onScreen = shipLabelOnScreen(x, y, projected.z, this.canvas.clientWidth, this.canvas.clientHeight);
            const visible = ship ? onScreen : (onScreen && labelIsUnobscured(rect, this.canvas.clientWidth, this.canvas.clientHeight, occupied));
            if (visible)
                occupied.push(rect);
            label.dataset.labelVisible = String(visible);
            label.dataset.offscreen = String(!onScreen);
            label.style.opacity = visible ? '1' : '0';
            label.style.visibility = visible ? 'visible' : 'hidden';
            const cardX = ship ? (rect.left + rect.right) / 2 : x, cardY = ship ? rect.bottom : y;
            label.style.transform = `translate(${cardX.toFixed(1)}px,${cardY.toFixed(1)}px) translate(-50%,-100%)`;
            label.style.zIndex = `${1000 - candidates.findIndex(candidate => candidate.label === label)}`;
            // A light tether keeps displaced cards connected to their actual ship.
            if (ship) {
                let tether = label.querySelector<HTMLElement>('.ship-label-tether');
                if (!tether) {
                    tether = document.createElement('span');
                    tether.className = 'ship-label-tether';
                    label.append(tether);
                }
                const dx = x - cardX, dy = y - cardY;
                const displaced = Math.hypot(dx, dy) > 8 && label.dataset.offscreen !== 'true';
                tether.hidden = !displaced;
                tether.style.height = `${Math.hypot(dx, dy)}px`;
                tether.style.transform = `rotate(${Math.atan2(-dx, dy)}rad)`;
            }
        }
    }
    /** Requests persist until the native snapshot removes them; transfers arrive once. */
    setActivity(requests: readonly AttentionRequest[], transfers: readonly AgentTransfer[]): void {
        this.attentionRequests = requests;
        this.updateSeaAlerts();
        if (!this.courierNavigation)
            return;
        this.encounters.addTransfers(transfers, this.encounterShips(), this.navigation, this.elapsed, this.now() / 1000, this.reducedMotion);
        for (const event of transfers) {
            if (this.couriers.has(event.id) || this.couriers.size >= 8)
                continue;
            const from = this.residents.find(resident => resident.id.toLowerCase() === event.fromAgentID.toLowerCase());
            const to = this.residents.find(resident => resident.id.toLowerCase() === event.toAgentID.toLowerCase());
            if (!from || !to)
                continue;
            const berth = (resident: Resident): Point => {
                const direction = resident.home.rotation ?? 0;
                const point = { x: resident.home.x + Math.sin(direction) * 1.7, z: resident.home.z + Math.cos(direction) * 1.7 };
                return pointIsWalkable(point, this.courierNavigation!) ? point : { x: resident.home.x, z: resident.home.z };
            };
            const start = berth(from), end = berth(to), path = findResidentPath(start, end, this.courierNavigation);
            if (!path?.length)
                continue;
            const route = [start, ...path];
            const boat = createCourierBoat(this.scene, this.shadow, this.mapRoot, event.id, event.kind);
            const wake = createShipWake(this.scene, this.mapRoot, `courier-${event.id}`);
            wake.scaling.set(0.4, 1, 0.4);
            const label = document.createElement('div');
            label.className = 'agent-label courier-label';
            label.dataset.transferId = event.id;
            const inner = document.createElement('div');
            inner.className = 'agent-label-inner';
            const text = document.createElement('span');
            text.className = 'agent-label-name';
            text.textContent = event.kind === 'artifact' ? 'Artifact delivery' : 'Agent handoff';
            inner.append(text);
            label.append(inner);
            label.title = `${from.agent.name} → ${to.agent.name}: ${event.title}`;
            label.addEventListener('click', () => this.callbacks.onTransfer?.(event.id));
            this.labels.append(label);
            this.couriers.set(event.id, { event, boat, route, wake, started: this.elapsed, duration: Math.max(14, Math.min(36, courierRouteLength(route) / 2.2)), label });
        }
        this.updateSeaActivity();
    }
    private updateSeaAlerts(): void {
        const active = new Set<string>();
        for (const resident of this.residents) {
            const request = this.attentionRequests.find(item => item.agentID.toLowerCase() === resident.id.toLowerCase());
            if (request) {
                active.add(request.id);
                if (!this.snails.has(request.id)) {
                    const snail = createDenDenMushi(this.scene, this.shadow, resident.actor.root, request.id, resident.id);
                    snail.root.metadata = { worldSignal: true };
                    snail.root.position.set(0.70, 0.95, 0.55);
                    this.snails.set(request.id, snail);
                }
            }
            this.updateLabel(resident);
        }
        for (const [id, snail] of this.snails)
            if (!active.has(id)) {
                snail.dispose();
                this.snails.delete(id);
            }
    }
    private updateSeaActivity(): void {
        for (const snail of this.snails.values())
            snail.animate(this.elapsed, this.reducedMotion);
        for (const [id, courier] of this.couriers) {
            const progress = this.reducedMotion || courier.arrivedAt !== undefined ? 1 : Math.min(1, (this.elapsed - courier.started) / courier.duration);
            if (progress === 1 && courier.arrivedAt === undefined)
                courier.arrivedAt = this.elapsed;
            if (courier.arrivedAt !== undefined && this.elapsed - courier.arrivedAt > 10) {
                courier.boat.dispose();
                courier.wake.dispose();
                courier.label.remove();
                this.couriers.delete(id);
                continue;
            }
            const pose = courierPose(courier.route, progress);
            courier.boat.root.position.set(pose.x, this.reducedMotion ? 0.02 : 0.035 + Math.sin(this.elapsed * 2.2) * 0.025, pose.z);
            courier.boat.root.rotation.set(this.reducedMotion ? 0 : Math.sin(this.elapsed * 1.8) * 0.018, pose.heading, this.reducedMotion ? 0 : Math.sin(this.elapsed * 2.4) * 0.04);
            courier.wake.position.set(pose.x, 0.078, pose.z);
            courier.wake.rotation.y = pose.heading;
            courier.wake.setEnabled(progress < 1 && !this.reducedMotion);
            courier.label.dataset.progress = progress.toFixed(3);
            courier.label.dataset.worldX = pose.x.toFixed(3);
            courier.label.dataset.worldZ = pose.z.toFixed(3);
            courier.label.dataset.delivered = String(progress === 1);
        }
    }
    private encounterShips(): EncounterShip[] {
        return this.residents.map(resident => ({ id: resident.id, agent: resident.agent, position: resident.motion, home: resident.home,
            heading: resident.motion.heading, walking: resident.motion.walking, speed: resident.motion.speed }));
    }
    private encounterHeldIDs(): Set<string> {
        const held = this.residents.filter(resident => reservesWorkHarbor(resident.agent.status) || (statusCanWander(resident.agent.status) && (resident.id === this.selectedID || resident.id === this.hoveredID))).map(resident => resident.id);
        return new Set([...held, ...this.attentionRequests.map(request => request.agentID)].map(id => id.toLowerCase()));
    }
    private updateShipEncounters(): void {
        if (!this.encounterVisuals)
            return;
        const descriptions = this.encounterVisuals.update(this.encounterShips(), [...this.encounters.alliances.values()], this.elapsed, this.reducedMotion, this.encounterHeldIDs(), [...this.encounters.idleEncounters.values()]);
        for (const resident of this.residents) {
            const description = descriptions.get(resident.id) ?? '';
            resident.label.dataset.encounter = description;
            const port = resident.label.querySelector('.agent-label-port');
            if (description && port)
                port.textContent = `${description} · ${this.getAgentHome(resident.id) ?? 'Home island'}`;
        }
    }
    private updateIslandWorkSignals(): void {
        if (!this.islandWorkSignals)
            return;
        const active = this.islandWorkSignals.update(this.residents.map(resident => ({ id: resident.id, status: resident.agent.status,
            motion: resident.motion, home: resident.home, harbor: this.seaHarbors[this.harborAssignments.get(resident.id)!]?.islandIndex })), this.elapsed, this.reducedMotion);
        for (const resident of this.residents)
            resident.label.dataset.workIsland = active.has(resident.id) ? String(active.get(resident.id)) : '';
    }
    private syncIslandCrew(resident: Resident): void {
        const activity = islandCrewActivity(resident.agent.status, resident.motion, resident.home);
        const harbor = this.harborAssignments.get(resident.id);
        const island = harbor === undefined ? undefined : this.seaHarbors[harbor]?.islandIndex;
        const plaza = island === undefined ? undefined : GRAND_LINE_CREW_PLAZAS[island];
        if (!activity || !plaza) {
            resident.crew?.dispose();
            resident.crew = undefined;
        }
        else {
            if (!resident.crew) {
                resident.crew = createIslandCrew(this.scene, this.shadow, this.mapRoot, resident.id, residentSeed(resident.id));
                resident.crew.root.position.set(plaza.x, plaza.y, plaza.z);
                resident.crew.root.rotation.y = plaza.rotation;
                // This short boarding plank retracts with the landing party, before any
                // departure. It connects the fixed jetty to the side of the parked hull.
                const berthDistance = Math.hypot(resident.home.x - plaza.x, resident.home.z - plaza.z);
                const wood = this.material('boarding-plank', '#966747'), rope = this.material('boarding-rope', '#dec68d');
                this.box('ship-boarding-plank', [0.48, 0.065, 0.91], [0, 0.635 - plaza.y, berthDistance - 1.065], wood, resident.crew.root);
                for (const x of [-0.23, 0.23])
                    this.box('ship-boarding-edge', [0.027, 0.035, 0.91], [x, 0.68 - plaza.y, berthDistance - 1.065], rope, resident.crew.root);
            }
            resident.crew.animate(activity === 'working', this.elapsed + resident.phase, this.reducedMotion);
        }
        const count = resident.crew?.count ?? 0;
        resident.label.dataset.crewAshore = String(count);
        resident.label.dataset.crewActivity = resident.crew ? activity ?? '' : '';
        resident.actor.root.metadata = { ...resident.actor.root.metadata, crewAshore: count };
    }
    private clearCouriers(): void {
        for (const courier of this.couriers.values()) {
            courier.boat.dispose();
            courier.wake.dispose();
            courier.label.remove();
        }
        this.couriers.clear();
    }
    focusResident(id: string): void {
        const resident = this.residents.find(item => item.id === id);
        if (!resident)
            return;
        this.selectedID = id;
        for (const item of this.residents)
            this.updateLabel(item);
        this.followingID = id;
        this.overview = false;
        this.focusRadius = Math.min(this.camera.radius, 16);
        this.camera.inertialPanningX = 0;
        this.camera.inertialPanningY = 0;
        this.camera.inertialAlphaOffset = 0;
        this.camera.inertialBetaOffset = 0;
        this.camera.inertialRadiusOffset = 0;
    }
    /** A paint/ship preference changes only artwork. The resident, berth, motion,
     * current work, selection, landing party and live Den Den signals stay put. */
    setShipStyles(styles: Readonly<Record<string, ShipAssetType>>): void {
        this.shipStyles = new Map(Object.entries(styles).filter(([, style]) => (SHIP_ASSET_TYPES as readonly string[]).includes(style)).map(([id, style]) => [id.toLowerCase(), style]));
        for (const resident of this.residents) {
            const appearance = this.shipStyles.get(resident.id.toLowerCase()) ?? this.appearanceAssignments.get(resident.id) as ShipAssetType | undefined;
            if (!appearance || resident.actor.appearance === appearance)
                continue;
            const actor = resident.actor;
            // Keep the owning root: attention markers are parented to this exact node.
            actor.idle?.stop();
            actor.walk?.stop();
            actor.model?.dispose();
            actor.fallback = replaceShipFallback(this.scene, this.shadow, actor.root, appearance);
            actor.appearance = appearance;
            actor.model = undefined;
            actor.loadedAppearance = undefined;
            actor.idle = undefined;
            actor.walk = undefined;
            this.upgradeActor(actor);
            this.setActorWalking(actor, resident.motion.walking, true);
            resident.label.dataset.appearance = appearance;
            this.updateLabel(resident);
        }
    }
    getAgentKind(id: string): 'ship' | undefined { return this.getAgentAppearance(id) ? 'ship' : undefined; }
    getAgentAppearance(id: string): ResidentAssetType | undefined { return (this.shipStyles.get(id.toLowerCase())) ?? this.appearanceAssignments.get(id); }
    getAgentHome(id: string): string | undefined {
        const index = this.harborAssignments.get(id);
        return index !== undefined ? this.seaHarbors[index]?.name : undefined;
    }
    setNavigationMode(mode: 'orbit' | 'pan'): void {
        this.navigationMode = mode;
        this.camera.detachControl();
        this.camera.attachControl(false, true, mode === 'pan' ? 0 : 2);
        this.camera.panningSensibility = 85;
        this.camera.inertialAlphaOffset = 0;
        this.camera.inertialBetaOffset = 0;
        this.canvas.style.cursor = mode === 'pan' ? 'move' : 'grab';
        this.canvas.dataset.navigationMode = mode;
    }
    panMap(direction: 'left' | 'right' | 'up' | 'down'): void {
        this.overview = false;
        this.followingID = undefined;
        this.focusRadius = undefined;
        const step = Math.max(0.45, this.camera.radius * 0.025);
        const right = new Vector3(-Math.sin(this.camera.alpha), 0, Math.cos(this.camera.alpha));
        const forward = new Vector3(-Math.cos(this.camera.alpha), 0, -Math.sin(this.camera.alpha));
        const offset = direction === 'left' ? right.scale(-step) : direction === 'right' ? right.scale(step) : direction === 'up' ? forward.scale(step) : forward.scale(-step);
        const target = this.camera.target.add(offset);
        const limit = this.theme.layout.radius + 12;
        target.x = Math.max(-limit, Math.min(limit, target.x));
        target.z = Math.max(-limit, Math.min(limit, target.z));
        this.camera.target.copyFrom(target);
    }
    setSailingArea(area: SailingArea): void {
        if (this.sailingArea === area)
            return;
        this.sailingArea = area;
        this.seaHarbors = sailingHarbors(area);
        this.harborAssignments.clear();
        this.workHarbors.clear();
        // A region change is an explicit fleet move. Clear old routes and berths
        // before the caller repopulates the visible fleet in the selected sea.
        this.setAgents([]);
        this.navigation = sailingNavigation(this.theme, area);
        this.courierNavigation = sailingNavigation(this.theme, area, 0.48);
        this.resetView();
    }
    resetView(): void {
        this.overview = true;
        this.followingID = undefined;
        this.focusRadius = undefined;
        this.camera.inertialAlphaOffset = 0;
        this.camera.inertialBetaOffset = 0;
        this.camera.inertialRadiusOffset = 0;
        this.camera.inertialPanningX = 0;
        this.camera.inertialPanningY = 0;
        const frame = sailingCameraFrame(this.sailingArea, this.canvas.clientWidth, this.canvas.clientHeight, this.camera.fov);
        this.camera.setTarget(new Vector3(frame.x, 0.9, frame.z));
        this.camera.alpha = Math.PI / 2;
        this.camera.beta = frame.beta;
        this.camera.lowerRadiusLimit = frame.minimum;
        this.camera.upperRadiusLimit = frame.maximum;
        this.camera.radius = frame.radius;
        this.camera.wheelDeltaPercentage = 0.035;
        this.canvas.dataset.sailingArea = this.sailingArea;
        this.canvas.dataset.overviewRadius = String(this.camera.radius);
        this.canvas.dataset.overviewTargetX = String(this.camera.target.x);
    }
    setVisible(visible: boolean): void {
        if (this.disposed || this.visible === visible)
            return;
        this.visible = visible;
        this.setHovered(undefined);
        this.lastFrame = 0;
        if (visible) {
            this.resizeRenderer();
            this.engine.runRenderLoop(this.render);
        }
        else {
            this.engine.stopRenderLoop(this.render);
        }
    }
    dispose(): void {
        this.assetRequests.abort();
        if (this.disposed)
            return;
        this.disposed = true;
        for (const cleanup of this.cleanups)
            cleanup();
        this.engine.stopRenderLoop();
        this.clearCouriers();
        this.encounters.clear();
        this.encounterVisuals?.dispose();
        this.islandWorkSignals?.dispose();
        this.newsCoo?.dispose();
        for (const resident of this.residents) {
            resident.workGlow?.dispose();
            resident.crew?.dispose();
        }
        for (const snail of this.snails.values())
            snail.dispose();
        this.snails.clear();
        this.labels.replaceChildren();
        this.ocean?.dispose();
        for (const container of this.containers.values())
            container.dispose();
        this.scene.dispose();
        this.engine.dispose();
    }
}
