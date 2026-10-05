import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLocalLineWorld, LOCAL_LINE_METADATA, localLineProjection } from '../src/localLineWorld.ts';
import type { WorldContext } from '../../sdk/src/world.ts';
import type { DisplayState, HostSnapshot, HostEvent, Response } from '../../sdk/src/protocol.ts';
import type { LocalLineUI, LocalLineUIOptions } from '../src/main.ts';

const agentID='11111111-1111-4111-8111-111111111111';
const state:DisplayState={agents:[{id:agentID,name:'Captain',role:'Research',status:'working'}],projectName:'Synthetic fixture',preferences:{'sailing-area':'left'},attentionRequests:[],transfers:[],canCreateAgent:true,nativeChrome:true,focusRequest:0,activityCenterRequest:0};
const snapshot=(display=state):HostSnapshot=>({version:2,type:'snapshot',sessionID:'session',scopeID:'scope',streamID:'stream',sequence:0,state:structuredClone(display)});
function setup(capabilities:('agents.read'|'agents.interact'|'world.preferences')[]=['agents.read','agents.interact','world.preferences']) {
  const calls:{command:string;args:unknown}[]=[], received:{message:any;initial?:boolean}[]=[];
  const counts={active:0,inactive:0,dispose:0};let options!:LocalLineUIOptions;let aborted=false;const cancel=new Set<()=>void>();
  const ui:LocalLineUI={receive(message,initial){received.push({message,initial});},activate(){counts.active++;},deactivate(){counts.inactive++;},dispose(){counts.dispose++;},notify(){}};
  const context:WorldContext={bridge:{capabilities,async request(command,args){calls.push({command,args});return{version:2,type:'response',sessionID:'session',scopeID:'scope',requestID:'request',ok:true,result:{}};}},
    storage:{get(){return undefined;},async set(key,value){calls.push({command:'storage.set',args:{key,value}});},async reset(){calls.push({command:'storage.reset',args:{}});}},
    assets:{resolve:p=>`https://local.test/${p}`},log(){},cancellation:{get aborted(){return aborted;},onAbort(fn){cancel.add(fn);return()=>{cancel.delete(fn);};}},clock:{now:()=>1700000000000,random:()=>.5}};
  const world=createLocalLineWorld({uiFactory:async value=>{options=value;return ui;}});
  return {world,context,calls,received,counts,ui,get options(){return options;},abort(){aborted=true;for(const fn of [...cancel])fn();}};
}
test('Local Line implements lifecycle without scheduling a second renderer loop or inventing a roster',async()=>{
  const f=setup();await f.world.initialize(f.context);assert.equal(f.received.length,0);assert.equal(f.counts.active,0);f.world.activate();assert.equal(f.counts.active,0);
  f.world.receiveHostSnapshot(snapshot({...state,agents:[]}));assert.deepEqual(f.received.at(-1)?.message.agents,[]);f.world.activate();assert.equal(f.counts.active,1);
  f.world.render({now:1700000000100,delta:.1});assert.equal(f.counts.active,1);f.world.deactivate();f.world.dispose();f.world.dispose();assert.equal(f.counts.dispose,1);assert.equal(f.options.signal?.aborted,true);
  f.world.receiveHostSnapshot(snapshot());f.world.activate();assert.equal(f.counts.active,1);assert.deepEqual(f.calls,[]);
});
test('snapshots mark historical transfers as seen; only event deliveries can animate fresh transfers',async()=>{
  const f=setup();await f.world.initialize(f.context);const first=snapshot();f.world.receiveHostSnapshot(first);assert.equal(f.received.at(-1)?.initial,true);
  const event:HostEvent={...first,type:'event',sequence:1,event:{type:'projection.updated',state:first.state}};delete (event as any).state;f.world.receiveHostEvent(event);assert.equal(f.received.at(-1)?.initial,false);
  f.world.receiveHostSnapshot({...first,sequence:2});assert.equal(f.received.at(-1)?.initial,true);f.world.dispose();
});
test('a new scoped stream clears the old visual roster before accepting the replacement',async()=>{
  const f=setup();await f.world.initialize(f.context);f.world.receiveHostSnapshot(snapshot());f.world.receiveHostSnapshot({...snapshot({...state,agents:[]}),sessionID:'new-session',scopeID:'other'});
  assert.equal(f.received.length,3);assert.deepEqual(f.received[1].message.agents,[]);assert.deepEqual(f.received[2].message.agents,[]);f.world.dispose();
});
test('user intentions delegate native surfaces, and reset only calls scoped world storage',async()=>{
  const f=setup();await f.world.initialize(f.context);f.world.receiveHostSnapshot(snapshot());
  await f.options.send({version:1,type:'selectAgent',agentID});await f.options.send({version:1,type:'openActivityCenter'});await f.options.send({version:1,type:'openSharedChat'});
  await f.options.send({version:1,type:'openIslandQuarters',islandID:'elbaf'});await f.options.send({version:1,type:'createAgent'});await f.options.send({version:1,type:'preferences',preferences:{sailingArea:'right'}});await f.options.send({version:1,type:'resetWorldPreferences'});
  assert.deepEqual(f.calls,[{command:'agents.open',args:{agentID}},{command:'navigation.open',args:{surface:'activity'}},{command:'chats.openShared',args:{}},{command:'presentation.open',args:{presentationID:'elbaf'}},{command:'agents.create',args:{}},{command:'storage.set',args:{key:'sailing-area',value:'right'}},{command:'storage.reset',args:{}}]);f.world.dispose();
});
test('read-only projection disables creation and rejects preferences without sending them',async()=>{
  const f=setup(['agents.read']);await f.world.initialize(f.context);f.world.receiveHostSnapshot(snapshot());assert.equal(f.received.at(-1)?.message.canCreateAgent,false);
  await assert.rejects(async()=>f.options.send({version:1,type:'preferences',preferences:{sailingArea:'left'}}),/not granted/);assert.deepEqual(f.calls,[]);f.world.dispose();
});
test('cancellation during asynchronous initialization disposes its late result exactly once',async()=>{
  const f=setup();let resolve!:(ui:LocalLineUI)=>void;let options!:LocalLineUIOptions;
  const world=createLocalLineWorld({uiFactory:value=>{options=value;return new Promise(r=>{resolve=r;});}});const pending=world.initialize(f.context);f.abort();assert.equal(options.signal?.aborted,true);resolve(f.ui);await pending;assert.equal(f.counts.dispose,1);world.activate();assert.equal(f.counts.active,0);world.dispose();assert.equal(f.counts.dispose,1);
});
test('Local Line preference projection validates ship identities and ignores unrelated host keys',()=>{
  const projected=localLineProjection({...state,preferences:{'sailing-area':'corrupt','ship-styles':{unknown:'ship_thousand_sunny'},'island-quarters-enabled':false,'other-setting':'unchanged'}},['agents.read']);
  assert.equal(projected.sailingArea,'whole');assert.deepEqual(projected.shipStyles,{});assert.equal(projected.islandQuartersEnabled,false);assert.equal(projected.theme,'grand-line');assert.equal((projected as any)['other-setting'],undefined);assert.equal((projected as any).preferences,undefined);
});
test('packaged world metadata and SDK declaration have identical versions and asset references',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../world.json',import.meta.url),'utf8'));const {capabilities,...metadata}=manifest;assert.deepEqual(metadata,LOCAL_LINE_METADATA);assert.deepEqual(capabilities,{required:['agents.read'],optional:['agents.interact','world.preferences']});
});
