import { COMMAND_CAPABILITIES, parseClientMessage, MAX_AGENTS, validPreferences } from '../packages/sdk/src/protocol.ts';
import type { Capability, ClientMessage, DisplayState, HostMessage, Request, Response } from '../packages/sdk/src/protocol.ts';
import type { Transport } from '../packages/core/src/client.ts';
const baseState=():DisplayState=>({agents:[],projectName:'Synthetic workspace',preferences:{theme:'local-line'},attentionRequests:[],transfers:[],canCreateAgent:true,nativeChrome:false,focusRequest:0,activityCenterRequest:0});
const statuses=['idle','working','queued','needs_attention','failed','completed'] as const;
export class MockHost implements Transport {
  state:DisplayState=baseState();capabilities:Capability[]=['agents.read','agents.interact','world.preferences'];
  commands:Request[]=[];now=1700000000000;paused=false;delay=false;dropNext=false;disconnected=false;
  private receive?:(message:unknown)=>void;private disconnect?:()=>void;private queue:HostMessage[]=[];
  private epoch=0;private sequence=0;private sessionID='';private scopeID='scope_1';private streamID='';private seed=42;private ids=0;
  private granted:Capability[]=[];
  private responses=new Map<string,Response>();private signatures=new Map<string,string>();
  subscribe(receive:(message:unknown)=>void){this.receive=receive;return()=>{if(this.receive===receive)this.receive=undefined;};}
  onDisconnect(callback:()=>void){this.disconnect=callback;return()=>{if(this.disconnect===callback)this.disconnect=undefined;};}
  random=():number=>{this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;};
  id=():string=>`00000000-0000-4000-8000-${(++this.ids).toString().padStart(12,'0')}`;
  reset(count=10){this.state=baseState();this.commands=[];this.ids=0;this.now=1700000000000;this.seed=42;for(let i=0;i<count;i++)this.add(false);this.publish();}
  add(publish=true){if(this.state.agents.length>=MAX_AGENTS)return;const i=this.state.agents.length;this.state.agents.push({id:this.id(),name:`Demo agent ${i+1}`,role:'Synthetic crew',status:statuses[i%statuses.length]});if(publish)this.publish();}
  remove(){const agent=this.state.agents.pop();if(!agent)return;this.state.attentionRequests=this.state.attentionRequests.filter(a=>a.agentID!==agent.id);this.state.transfers=this.state.transfers.filter(t=>t.fromAgentID!==agent.id&&t.toAgentID!==agent.id);if(this.state.selectedAgentID===agent.id)delete this.state.selectedAgentID;this.publish();}
  setStatus(status:typeof statuses[number]){const agent=this.state.agents.find(a=>a.id===this.state.selectedAgentID)??this.state.agents[0];if(agent){agent.status=status;this.publish();}}
  rename(){if(this.state.agents[0]){this.state.agents[0].name='Updated demo captain';this.publish();}}
  approval(){const agent=this.state.agents[0];if(!agent)return;agent.status='needs_attention';this.state.attentionRequests=[{id:this.id(),agentID:agent.id,kind:'approval',title:'Synthetic approval — opens native confirmation'}];this.publish();}
  resolveApproval(){this.state.attentionRequests=[];this.setStatus('idle');}
  transfer(){if(this.state.agents.length<2)return;this.state.transfers=[{id:this.id(),fromAgentID:this.state.agents[0].id,toAgentID:this.state.agents[1].id,kind:'handoff',title:'Synthetic handoff',occurredAt:this.now/1000}];this.publish();}
  private emit(message:HostMessage){if(this.disconnected)return;if(this.dropNext){this.dropNext=false;return;}if(this.delay){if(this.queue.length<128)this.queue.push(structuredClone(message));return;}this.receive?.(structuredClone(message));}
  step(reverse=false){this.now+=33;const next=reverse?this.queue.pop():this.queue.shift();if(next)this.receive?.(next);else this.publish();}
  flush(){while(this.queue.length)this.receive?.(this.queue.shift());}
  private snapshot(){this.emit({version:2,type:'snapshot',sessionID:this.sessionID,scopeID:this.scopeID,streamID:this.streamID,sequence:++this.sequence,state:structuredClone(this.state)});}
  publish(){if(this.sessionID)this.emit({version:2,type:'event',sessionID:this.sessionID,scopeID:this.scopeID,streamID:this.streamID,sequence:++this.sequence,event:{type:'projection.updated',state:structuredClone(this.state)}});}
  duplicate(){const event:HostMessage={version:2,type:'event',sessionID:this.sessionID,scopeID:this.scopeID,streamID:this.streamID,sequence:this.sequence,event:{type:'projection.updated',state:structuredClone(this.state)}};this.emit(event);}
  freshSnapshot(){this.snapshot();}
  revoke(reason='Synthetic disconnection'){this.emit({version:2,type:'revoked',sessionID:this.sessionID,scopeID:this.scopeID,reason});this.disconnected=true;this.sessionID='';this.queue=[];this.disconnect?.();}
  switchWorkspace(){this.scopeID=`scope_${++this.epoch}`;this.state=baseState();this.state.projectName='Synthetic alternate workspace';this.revoke('Workspace switched; reconnect explicitly');}
  reconnect(){this.disconnected=false;this.queue=[];this.sessionID='';}
  send(raw:ClientMessage){
    const message=parseClientMessage(raw);if(!message||this.disconnected)return;
    if(message.type==='hello'){
      if(!message.protocols.includes(2)||message.sdkVersion!==1||!/^0\.2\.\d+$/.test(message.runtimeVersion)||message.requiredCapabilities.some(c=>!this.capabilities.includes(c))){this.emit({version:2,type:'rejected',requestID:message.requestID,error:{code:'incompatible',message:'Mock host cannot satisfy protocol/capabilities'}});return;}
      this.sessionID=`session_${++this.epoch}`;this.streamID=`stream_${this.epoch}`;this.sequence=0;this.responses.clear();this.signatures.clear();
      const capabilities=this.capabilities.filter(c=>[...message.requiredCapabilities,...message.optionalCapabilities].includes(c));
      this.granted=capabilities;this.state.canCreateAgent=capabilities.includes('agents.interact');
      this.emit({version:2,type:'welcome',requestID:message.requestID,protocol:2,hostVersion:'4.0.0',capabilities,sessionID:this.sessionID,scopeID:this.scopeID,streamID:this.streamID});this.snapshot();return;
    }
    if(message.sessionID!==this.sessionID||message.scopeID!==this.scopeID||message.type==='cancel')return;
    const reply=(ok:boolean,code='denied',text='Capability denied'):Response=>ok?{version:2,type:'response',requestID:message.requestID,sessionID:this.sessionID,scopeID:this.scopeID,ok:true,result:{}}:{version:2,type:'response',requestID:message.requestID,sessionID:this.sessionID,scopeID:this.scopeID,ok:false,error:{code:code as 'denied',message:text}};
    if(!this.capabilities.includes(COMMAND_CAPABILITIES[message.command])||!this.granted.includes(COMMAND_CAPABILITIES[message.command])){this.emit(reply(false));return;}
    const signature=JSON.stringify([message.command,message.arguments]);
    if(this.signatures.has(message.requestID)){this.emit(this.signatures.get(message.requestID)===signature?this.responses.get(message.requestID)!:reply(false,'invalid_request','Request identity reused'));return;}
    if(this.responses.size>=256){this.emit(reply(false,'quota','Reconnect before issuing more commands'));return;}
    if(message.arguments.agentID&&!this.state.agents.some(a=>a.id===message.arguments.agentID)){this.emit(reply(false,'not_found','Agent not in current workspace'));return;}
    if(message.command==='attention.open'&&!this.state.attentionRequests.some(a=>a.id===message.arguments.requestID)){this.emit(reply(false,'not_found','Attention request not in current workspace'));return;}
    if(message.command==='transfers.open'&&!this.state.transfers.some(t=>t.id===message.arguments.transferID)){this.emit(reply(false,'not_found','Transfer not in current workspace'));return;}
    if(message.command==='preferences.set'&&!validPreferences({...this.state.preferences,[String(message.arguments.key)]:message.arguments.value})){this.emit(reply(false,'quota','Preference quota exceeded'));return;}
    this.commands.push(message);this.signatures.set(message.requestID,signature);
    switch(message.command){
      case 'host.snapshot':this.snapshot();break;
      case 'agents.open':this.state.selectedAgentID=String(message.arguments.agentID);this.state.focusRequest++;this.publish();break;
      case 'selection.clear':delete this.state.selectedAgentID;this.publish();break;
      case 'preferences.set':this.state.preferences[String(message.arguments.key)]=message.arguments.value;this.publish();break;
      case 'preferences.reset':this.state.preferences={theme:'local-line'};this.publish();break;
      // Native create/chat/navigation commands are logged intentions, never synthetic successful work.
    }
    const response=reply(true);this.responses.set(message.requestID,response);this.emit(response);
  }
}
