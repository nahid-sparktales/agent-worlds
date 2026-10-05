import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Projection } from '../../packages/core/src/projection.ts';
const vectors = JSON.parse(readFileSync(new URL('../fixtures/wire-v2.json',import.meta.url),'utf8')).vectors;
const fixture = (name:string) => structuredClone(vectors.find((v:any)=>v.id===name).message);
test('snapshot creates only authorized stable identities; empty snapshot clears removed agents',()=>{
  const p=new Projection();p.connect(fixture('welcome'));assert.equal(p.receive(fixture('snapshot')),'applied');
  assert.equal(p.state?.agents.length,2);
  const empty=fixture('empty-roster');empty.sequence=1;assert.equal(p.receive(empty),'applied');assert.deepEqual(p.state?.agents,[]);
});
test('duplicates, late events, scope/session swaps, gaps, and stream replacement cannot corrupt projection',()=>{
  const p=new Projection();p.connect(fixture('welcome'));
  const event=fixture('event'); assert.equal(p.receive(event),'resnapshot');assert.equal(p.state,undefined);
  assert.equal(p.receive(fixture('snapshot')),'applied');
  assert.equal(p.receive(event),'applied');assert.equal(p.receive(event),'ignored');
  assert.equal(p.receive({...event,sequence:2,scopeID:'other'}),'ignored');
  assert.equal(p.receive({...event,sequence:2,sessionID:'old'}),'ignored');
  assert.equal(p.receive({...event,sequence:4}),'resnapshot');assert.equal(p.state,undefined);
  assert.equal(p.receive({...event,sequence:2}),'resnapshot');
  assert.equal(p.receive({...fixture('snapshot'),sequence:5}),'applied');
  assert.equal(p.receive({...event,sequence:6,streamID:'new'}),'resnapshot');assert.equal(p.state,undefined);
  assert.equal(p.receive({...event,sequence:6}),'resnapshot');assert.equal(p.state,undefined);
  p.connect({...fixture('welcome'),sessionID:'replacement',streamID:'new'}); assert.equal(p.state,undefined);
  assert.equal(p.receive({...fixture('snapshot'),sessionID:'replacement',streamID:'new'}),'applied');
});
test('projection owns a clone; subsequent caller mutation is not authoritative',()=>{
  const p=new Projection();p.connect(fixture('welcome'));const s=fixture('snapshot');p.receive(s);s.state.agents=[];assert.equal(p.state?.agents.length,2);
});
