import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HostClient } from '../../packages/core/src/client.ts';
const vectors=JSON.parse(readFileSync(new URL('../fixtures/wire-v2.json',import.meta.url),'utf8')).vectors;
const fixture=(id:string)=>structuredClone(vectors.find((v:any)=>v.id===id).message);
function harness(required:any[]=['agents.read'],optional:any[]=['agents.interact','world.preferences']){
  const sent:any[]=[],states:any[]=[],snapshots:any[]=[],events:any[]=[],scheduled=new Set<()=>void>();let receive=(v:any)=>{},invalidations=0;
  const transport={send:(v:any)=>sent.push(v),subscribe:(f:any)=>{receive=f;return()=>{receive=()=>{};};}};
  const client=new HostClient(transport,{required,optional,id:()=> 'hello_1',status:(...s)=>states.push(s),snapshot:s=>snapshots.push(s),event:e=>events.push(e),visibility:()=>{},invalidated:()=>{invalidations++;},timers:{after:(_,f)=>{scheduled.add(f);return()=>{scheduled.delete(f);};}}});
  return{client,sent,states,snapshots,events,receive:(v:any)=>receive(v),tick:()=>{for(const f of [...scheduled])f();},invalidations:()=>invalidations};
}
test('handshake precedes data and commands; full/read-only/missing optional capabilities negotiate',async()=>{
  for(const readOnly of [false,true]){
    const h=harness();h.client.start();h.receive(fixture('snapshot'));assert.equal(h.snapshots.length,0);
    await assert.rejects(h.client.request('agents.create'));const w=fixture('welcome');if(readOnly)w.capabilities=['agents.read'];h.receive(w);h.receive(fixture('snapshot'));assert.equal(h.snapshots.length,1);
    if(readOnly)await assert.rejects(h.client.request('agents.create'));
    else{const promise=h.client.request('agents.create');const request=h.sent.at(-1);h.receive({...fixture('response-ok'),requestID:request.requestID});assert.equal((await promise).ok,true);}
    h.client.dispose();
  }
});
test('missing required or rejected protocol fails closed and never delivers state',()=>{
  for(const response of [{...fixture('welcome'),capabilities:[]},fixture('rejected')]){
    const h=harness();h.client.start();h.receive(response);h.receive(fixture('snapshot'));assert.equal(h.snapshots.length,0);assert.equal(h.states.at(-1)[0],'incompatible');h.client.dispose();
  }
});
test('gap requests one authoritative snapshot; stale responses cannot satisfy current requests',async()=>{
  const h=harness();h.client.start();h.receive(fixture('welcome'));h.receive(fixture('snapshot'));
  h.receive({...fixture('event'),sequence:5});h.receive({...fixture('event'),sequence:6});
  assert.equal(h.sent.filter(v=>v.command==='host.snapshot').length,1);assert.equal(h.events.length,0);
  const request=h.sent.at(-1);h.receive({...fixture('response-ok'),requestID:request.requestID,scopeID:'old'});assert.equal(h.client.projection.state,undefined);
  h.receive({...fixture('snapshot'),sequence:6});h.receive({...fixture('response-ok'),requestID:request.requestID});assert.equal(h.snapshots.length,2);
  await Promise.resolve();h.client.dispose();
});
test('uncertain mutation times out without replay; revoked/disposed sessions clear projection and reject pending',async()=>{
  const h=harness();h.client.start();h.receive(fixture('welcome'));h.receive(fixture('snapshot'));
  const request=h.client.request('agents.create');h.tick();await assert.rejects(request,/timed out/);
  assert.equal(h.sent.filter(v=>v.command==='agents.create').length,1);assert.equal(h.sent.at(-1).type,'cancel');
  const pending=h.client.request('agents.create');h.receive(fixture('revoked'));await assert.rejects(pending);assert.equal(h.client.projection.state,undefined);
  h.receive(fixture('snapshot'));assert.equal(h.snapshots.length,1);await assert.rejects(h.client.request('agents.create'));
  assert.equal(h.sent.filter(v=>v.command==='agents.create').length,2);
});
test('missing transport and handshake timeout never activate a mock host',()=>{
  const h=harness();h.client.start();h.tick();assert.equal(h.states.at(-1)[0],'disconnected');assert.equal(h.client.projection.state,undefined);assert.equal(h.sent.length,1);
});
