import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseClientMessage, parseHostMessage, boundedJSON, MAX_PAYLOAD_BYTES, validDisplayState } from '../../packages/sdk/src/protocol.ts';
const vectors = JSON.parse(readFileSync(new URL('../fixtures/wire-v2.json',import.meta.url),'utf8')).vectors;
for (const vector of vectors) test(`wire: ${vector.id}`, () => { assert.equal(Boolean((vector.direction === 'client' ? parseClientMessage : parseHostMessage)(vector.message)),vector.valid); });
test('payload quota is UTF-8 bytes, rejects cycles/non-JSON and excess nesting', () => {
  assert.equal(boundedJSON('🐳'.repeat(MAX_PAYLOAD_BYTES / 4)), false);
  const cyclic: any = {}; cyclic.self = cyclic;
  assert.equal(boundedJSON(cyclic),false); assert.equal(boundedJSON({v:NaN}),false); assert.equal(boundedJSON({v:()=>{}}),false);
  let deep: any = {}; for(let i=0;i<10;i++) deep={deep}; assert.equal(boundedJSON(deep),false);
});
test('bounded collections and unknown private display fields fail closed', () => {
  const state = structuredClone(vectors.find((v:any)=>v.id==='snapshot').message.state);
  state.agents = Array.from({length:501},(_,i)=>({id:`00000000-0000-4000-8000-${i.toString().padStart(12,'0')}`,name:'Agent',role:'Role',status:'idle'}));
  assert.equal(validDisplayState(state),false);
  state.agents=[]; state.transcripts=[]; assert.equal(validDisplayState(state),false);
});
