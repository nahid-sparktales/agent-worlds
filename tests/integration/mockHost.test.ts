import test from 'node:test';
import assert from 'node:assert/strict';
import { MockHost } from '../../dev/mockHost.ts';
import { parseHostMessage } from '../../packages/sdk/src/protocol.ts';
const hello:any={version:2,type:'hello',requestID:'hello_1',protocols:[2],runtimeVersion:'0.2.0',sdkVersion:1,requiredCapabilities:['agents.read'],optionalCapabilities:['agents.interact','world.preferences']};
function harness(count=10){const host=new MockHost();host.reset(count);const received:any[]=[];host.subscribe(message=>{assert.ok(parseHostMessage(message));received.push(message);});host.send(hello);return{host,received,request(command:string,args:any={},id='request_1'){const w=received.find(m=>m.type==='welcome');host.send({version:2,type:'request',requestID:id,sessionID:w.sessionID,scopeID:w.scopeID,command,arguments:args} as any);}};}
test('standalone scenarios use real validated protocol, stable IDs and bounded roster sizes',()=>{
  for(const count of [0,10,100,500]){const h=harness(count);assert.equal(h.received.at(-1).state.agents.length,count);const before=h.host.state.agents.map(a=>a.id);h.host.add();assert.deepEqual(h.host.state.agents.slice(0,count).map(a=>a.id),before);assert.ok(h.host.state.agents.length<=500);h.host.remove();assert.equal(h.host.state.agents.length,Math.min(count+1,500)-1);}
});
test('mock host rejects forged denied capabilities and duplicate changed requests',()=>{
  const h=harness();h.host.capabilities=['agents.read'];h.request('agents.create');assert.equal(h.received.at(-1).error.code,'denied');assert.equal(h.host.commands.length,0);
  h.host.capabilities=['agents.read','agents.interact','world.preferences'];h.request('agents.open',{agentID:h.host.state.agents[0].id},'open_1');h.request('agents.open',{agentID:h.host.state.agents[0].id},'open_1');assert.equal(h.host.commands.length,1);
  h.request('agents.create',{},'open_1');assert.equal(h.received.at(-1).error.code,'invalid_request');assert.equal(h.host.commands.length,1);
});
test('world reset only clears cosmetic preferences; native intentions never create canonical work',()=>{
  const h=harness();const ids=h.host.state.agents.map(a=>a.id);h.request('preferences.set',{key:'appearance',value:'dark'},'p1');h.request('preferences.reset',{},'p2');assert.deepEqual(h.host.state.preferences,{theme:'local-line'});assert.deepEqual(h.host.state.agents.map(a=>a.id),ids);
  h.request('agents.create',{},'create1');h.request('chats.openShared',{},'chat1');assert.deepEqual(h.host.state.agents.map(a=>a.id),ids);
});
test('deterministic seeded clock, delayed/out-of-order/duplicate/drop faults and scope resets are explicit',()=>{
  const a=new MockHost(),b=new MockHost();assert.equal(a.random(),b.random());a.step();assert.equal(a.now,1700000000033);
  const h=harness();h.host.delay=true;h.host.add();h.host.remove();const old=h.received.length;h.host.step(true);assert.equal(h.received.length,old+1);const newer=h.received.at(-1).sequence;h.host.step();assert.ok(h.received.at(-1).sequence<newer);
  h.host.delay=false;h.host.dropNext=true;h.host.add();const sequence=h.received.at(-1).sequence;h.host.publish();assert.ok(h.received.at(-1).sequence>sequence+1);
  h.host.duplicate();assert.equal(h.received.at(-1).sequence,h.received.at(-2).sequence);
  h.host.switchWorkspace();assert.equal(h.host.state.agents.length,0);assert.equal(h.host.disconnected,true);
});

test('pausing the simulation preserves live projection and command responses',()=>{
  const h=harness();h.host.paused=true;const time=h.host.now;h.host.add();
  assert.equal(h.received.at(-1).type,'event');assert.equal(h.received.at(-1).event.state.agents.length,11);
  h.request('navigation.open',{surface:'calendar'});assert.equal(h.received.at(-1).type,'response');assert.equal(h.received.at(-1).ok,true);assert.equal(h.host.now,time);
});
test('a disposed old subscriber cannot detach a replacement transport session',()=>{
  const host=new MockHost();let oldMessages=0,newMessages=0,oldDisconnects=0,newDisconnects=0;
  const disposeOld=host.subscribe(()=>oldMessages++);const disposeOldDisconnect=host.onDisconnect(()=>oldDisconnects++);
  host.subscribe(()=>newMessages++);host.onDisconnect(()=>newDisconnects++);disposeOld();disposeOldDisconnect();
  host.send(hello);assert.equal(oldMessages,0);assert.equal(newMessages,2);host.revoke();assert.equal(oldDisconnects,0);assert.equal(newDisconnects,1);
});
