import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WorldRuntime } from '../../packages/core/src/runtime.ts';
import type { World, WorldContext } from '../../packages/sdk/src/world.ts';
const vectors=JSON.parse(readFileSync(new URL('../fixtures/wire-v2.json',import.meta.url),'utf8')).vectors;
const snapshot=vectors.find((v:any)=>v.id==='snapshot').message;
/** Test-only non-nautical implementation: no renderer, ships, or asset dependency. */
class CounterWorld implements World {
  metadata={id:'counter',name:'Counter',version:'1.0.0',description:'Test only',icon:'icon.svg',minimumAgentWorldsVersion:'0.2.0',sdkVersion:1 as const,entrypoint:'counter.ts',assets:[]};
  capabilities={required:['agents.read' as const],optional:[]};count=0;activated=0;disposed=0;active=false;context?:WorldContext;
  async initialize(context:WorldContext){this.context=context;}
  receiveHostSnapshot(s:any){this.count=s.state.agents.length;}
  receiveHostEvent(e:any){this.count=e.event.state.agents.length;}
  render(){}
  activate(){if(!this.active){this.active=true;this.activated++;}}
  deactivate(){this.active=false;}
  dispose(){this.active=false;this.disposed++;}
}
const context:any={bridge:{capabilities:['agents.read'],request:async()=>{}},storage:{get:()=>undefined,set:async()=>{},reset:async()=>{}},assets:{resolve:(p:string)=>p},log:()=>{},clock:{now:()=>0,random:()=>0.5}};
test('a non-nautical world uses the same lifecycle; repeated mount/visibility does not accumulate loops',async()=>{
  const runtime=new WorldRuntime();
  for(let i=0;i<10;i++){
    const world=new CounterWorld();await runtime.load(world,context);await runtime.setActive(true);assert.equal(world.active,false);
    runtime.snapshot(snapshot);await runtime.setActive(true);await runtime.setActive(true);assert.equal(world.activated,1);assert.equal(world.count,2);
    await runtime.setActive(false);assert.equal(world.active,false);await runtime.dispose();await runtime.dispose();assert.equal(world.disposed,1);assert.equal(world.context?.cancellation.aborted,true);
    runtime.snapshot(snapshot);assert.equal(world.active,false);
  }
});
test('failed initialization disposes resources and never activates',async()=>{
  const runtime=new WorldRuntime();const world=new CounterWorld();world.initialize=async()=>{throw new Error('Injected renderer failure');};
  await assert.rejects(runtime.load(world,context));assert.equal(world.active,false);assert.equal(world.disposed,1);
});
test('cancellation remains aborted after a replacement is initialized',async()=>{
  const runtime=new WorldRuntime();const a=new CounterWorld(),b=new CounterWorld();await runtime.load(a,context);await runtime.load(b,context);
  assert.equal(a.context?.cancellation.aborted,true);assert.equal(b.context?.cancellation.aborted,false);await runtime.dispose();
});

test('late callbacks from a disposed/replaced world cannot issue host commands or write storage', async()=>{
  const runtime=new WorldRuntime(), world=new CounterWorld();let calls=0;
  await runtime.load(world,{...context,bridge:{capabilities:['agents.read'],request:async()=>{calls++;return {} as any;}}});
  await runtime.dispose();assert.throws(()=>world.context!.bridge.request('agents.create'),/lifecycle ended/);assert.throws(()=>world.context!.storage.set('cosmetic',true),/lifecycle ended/);assert.equal(calls,0);
});
