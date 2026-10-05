import type { Point } from './state.ts';
import { GRAND_LINE_MAP_RADIUS, GRAND_LINE_STATIONS, GRAND_LINE_WANDER_POINTS, GRAND_LINE_OBSTACLES, GRAND_LINE_SAILING_BOUNDS } from './grandLineGeography.ts';
export const DEFAULT_SHIP_ASSET_TYPES = ['ship_thousand_sunny', 'ship_going_merry', 'ship_baratie', 'ship_navy_h03', 'ship_polar_tang', 'ship_spade_pirates', 'ship_red_force', 'ship_moby_dick', 'ship_perfume_yuda', 'ship_oro_jackson', 'ship_queen_mama_chanter', 'ship_dragons_ship'] as const;
export const SHIP_ASSET_TYPES = [...DEFAULT_SHIP_ASSET_TYPES, 'ship_mihawk_coffin', 'ship_garp_battleship', 'ship_marine_patrol'] as const;
export type ShipAssetType = typeof SHIP_ASSET_TYPES[number];
/** Visually calibrated against the packaged GLBs: after Babylon's glTF
 * handedness conversion, each bow points along +X. Residents move along +Z.
 * Keep this explicit so a new model requires its own facing calibration. */
export const SHIP_MODEL_ROTATIONS: Readonly<Record<ShipAssetType, number>> = {
  ship_thousand_sunny: -Math.PI / 2, ship_going_merry: -Math.PI / 2, ship_baratie: -Math.PI / 2,
  ship_navy_h03: -Math.PI / 2, ship_polar_tang: -Math.PI / 2, ship_spade_pirates: -Math.PI / 2,
  ship_red_force: -Math.PI / 2, ship_moby_dick: -Math.PI / 2, ship_perfume_yuda: -Math.PI / 2,
  ship_oro_jackson: -Math.PI / 2, ship_queen_mama_chanter: -Math.PI / 2, ship_dragons_ship: -Math.PI / 2,
  ship_mihawk_coffin: -Math.PI / 2, ship_garp_battleship: -Math.PI / 2, ship_marine_patrol: -Math.PI / 2,
};
export const SHIP_NAMES: Record<ShipAssetType, string> = {
  ship_thousand_sunny: 'Thousand Funny', ship_going_merry: 'Going Sherry', ship_baratie: 'BaratAI',
  ship_navy_h03: 'Navy Q4', ship_polar_tang: 'Polar Tensor', ship_spade_pirates: "Spade Prompters’ Ship",
  ship_red_force: 'Thread Force', ship_moby_dick: 'Moby Disk', ship_perfume_yuda: 'Perfume CUDA',
  ship_oro_jackson: 'Oro JSON', ship_queen_mama_chanter: 'Queen Llama Chanter', ship_dragons_ship: "Dragon’s Chip",
  ship_mihawk_coffin: "Mihawk’s Coffin Boat", ship_garp_battleship: "Garp’s Battleship", ship_marine_patrol: 'Marine Patrol',
};
export const SCENERY_ASSET_TYPES = ['island_twin_cape', 'island_little_garden', 'island_drum', 'island_alabasta', 'island_water_seven', 'island_enies_lobby', 'island_sabaody', 'island_marineford', 'island_wano', 'island_whole_cake', 'island_laugh_tale', 'island_jaya', 'island_skypiea', 'scenery_red_line', 'scenery_reverse_mountain', 'creature_laboon', 'creature_sea_king', 'island_elbaf', 'island_egghead', 'island_mary_geoise', 'island_impel_down', 'island_amazon_lily', 'island_sabaody_archipelago', 'creature_zunesha', 'creature_momonosuke', 'island_dressrosa', 'island_punk_hazard', 'island_hachinosu', 'island_long_ring_long_land'] as const;
export type SceneryAssetType = typeof SCENERY_ASSET_TYPES[number];

export const RESIDENT_ASSET_TYPES = SHIP_ASSET_TYPES;
export type ResidentAssetType = ShipAssetType;
export const ASSET_TYPES = [...SHIP_ASSET_TYPES, ...SCENERY_ASSET_TYPES] as const;
export type AssetType = typeof ASSET_TYPES[number];
export type Placement = Point & { rotation?: number };
export type CircleObstacle = Point & { radius: number };
export type SailingBounds = { minZ: number; maxZ: number };
export type ThemeLayout = { sailingBounds?: SailingBounds; radius: number; stations: Placement[]; props: never[]; obstacles: CircleObstacle[]; wanderPoints: Point[] };
export type Theme = { version: 1; id: 'grand-line'; name: string; description: string; environment: 'ocean'; assets: Partial<Record<AssetType,string>>; heights: Record<AssetType,number>; rotations: Partial<Record<AssetType,number>>; palette: {ground:string;accent:string;sky:string}; layout: ThemeLayout };
export const DEFAULT_STATIONS = GRAND_LINE_STATIONS;
export const DEFAULT_WANDER_POINTS = GRAND_LINE_WANDER_POINTS;
export const DEFAULT_THEME: Theme = { version:1,id:'grand-line',name:'Local Line',description:'Your agents, at sea.',environment:'ocean',assets:{}, heights:{ship_thousand_sunny: 3.2, ship_going_merry: 2.9, ship_baratie: 3.2, ship_navy_h03: 3.1, ship_polar_tang: 2.1, ship_spade_pirates: 3.2, ship_red_force: 3.4, ship_moby_dick: 3.3, ship_perfume_yuda: 3.2, ship_oro_jackson: 3.4, ship_queen_mama_chanter: 3.5, ship_dragons_ship: 3.3,
    ship_mihawk_coffin: 2.7, ship_garp_battleship: 3.4, ship_marine_patrol: 3.0,
    island_twin_cape: 4.8, island_little_garden: 4.5, island_drum: 6, island_alabasta: 4.2,
    island_water_seven: 4.4, island_enies_lobby: 4.6, island_sabaody: 5.5, island_marineford: 4.7,
    island_wano: 5, island_whole_cake: 5, island_laugh_tale: 3.2, island_jaya: 3.6, island_skypiea: 4.4, scenery_red_line: 7, scenery_reverse_mountain: 8, creature_laboon: 1.8, creature_sea_king: 3.4, island_elbaf: 7.5, island_egghead: 5, island_mary_geoise: 5, island_impel_down: 3.6, island_amazon_lily: 5.5, island_sabaody_archipelago: 6, creature_zunesha: 8, creature_momonosuke: 2, island_dressrosa: 5, island_punk_hazard: 3.6, island_hachinosu: 4.5, island_long_ring_long_land: 1.7 },rotations:{...SHIP_MODEL_ROTATIONS},palette:{ground:'#238eaa',accent:'#72e7cd',sky:'#091e2c'},layout:{radius:GRAND_LINE_MAP_RADIUS,stations:GRAND_LINE_STATIONS.map(p=>({...p})),props:[],obstacles:GRAND_LINE_OBSTACLES.map(p=>({...p})),wanderPoints:GRAND_LINE_WANDER_POINTS.map(p=>({...p})),sailingBounds:{...GRAND_LINE_SAILING_BOUNDS}} };
export function safeAssetPath(value:unknown):value is string { return typeof value==='string' && /^assets\/[a-zA-Z0-9_./-]+\.glb(?:\.gz)?$/.test(value) && !value.split('/').some(p=>p==='..'||p==='.') && !value.includes('//'); }
const point=(v:unknown):v is Placement => !!v&&typeof v==='object'&&Number.isFinite((v as Placement).x)&&Number.isFinite((v as Placement).z)&&Math.abs((v as Placement).x)<=96&&Math.abs((v as Placement).z)<=96&&((v as Placement).rotation===undefined||Number.isFinite((v as Placement).rotation));
const radius=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=.2&&v<=8;
/** Local Line configuration only; invalid or other-world input uses procedural Local Line. */
export function parseTheme(input:unknown):Theme {
 const result:Theme={...DEFAULT_THEME,assets:{},heights:{...DEFAULT_THEME.heights},rotations:{...SHIP_MODEL_ROTATIONS},palette:{...DEFAULT_THEME.palette},layout:{...DEFAULT_THEME.layout}};
 if(!input||typeof input!=='object')return result; const v=input as Record<string,unknown>; if(v.version!==1||!['grand-line','local-line'].includes(v.id as string)||v.environment!=='ocean')return result;
 if(typeof v.name==='string'&&v.name.length<=100)result.name=v.name; if(typeof v.description==='string'&&v.description.length<=500)result.description=v.description;
 for(const type of ASSET_TYPES){const asset=(v.assets as Record<string,unknown>|undefined)?.[type];if(safeAssetPath(asset))result.assets[type]=asset;const h=(v.heights as Record<string,unknown>|undefined)?.[type];if(radius(h))result.heights[type]=h;const rotation=(v.rotations as Record<string,unknown>|undefined)?.[type];if(typeof rotation==='number'&&Number.isFinite(rotation))result.rotations[type]=rotation;}
 for(const key of ['ground','accent','sky'] as const){const color=(v.palette as Record<string,unknown>|undefined)?.[key];if(typeof color==='string'&&/^#[\da-f]{6}$/i.test(color))result.palette[key]=color;}
 const layout=v.layout as Record<string,unknown>|undefined;if(layout&&typeof layout==='object'){
 if(typeof layout.radius==='number'&&Number.isFinite(layout.radius)&&layout.radius>=10&&layout.radius<=84)result.layout.radius=layout.radius;
 const bounds=layout.sailingBounds as Partial<SailingBounds>|undefined;if(bounds&&typeof bounds.minZ==='number'&&typeof bounds.maxZ==='number'&&Number.isFinite(bounds.minZ)&&Number.isFinite(bounds.maxZ)&&bounds.minZ<bounds.maxZ-4&&bounds.minZ>=-result.layout.radius&&bounds.maxZ<=result.layout.radius)result.layout.sailingBounds={minZ:bounds.minZ,maxZ:bounds.maxZ};
 if(Array.isArray(layout.stations)&&layout.stations.length<=12&&layout.stations.every(p=>point(p)&&Math.hypot(p.x,p.z)<result.layout.radius-1))result.layout.stations=layout.stations.map(p=>({...p}));
 if(Array.isArray(layout.obstacles)&&layout.obstacles.length<=64&&layout.obstacles.every(p=>point(p)&&radius((p as CircleObstacle).radius)))result.layout.obstacles=layout.obstacles.map(p=>({x:p.x,z:p.z,radius:p.radius}));
 if(Array.isArray(layout.wanderPoints)&&layout.wanderPoints.length<=64&&layout.wanderPoints.every(p=>point(p)&&Math.hypot(p.x,p.z)<result.layout.radius-.5))result.layout.wanderPoints=layout.wanderPoints.map(p=>({x:p.x,z:p.z}));
 }return result;
}
