import { startApplication, showUnavailable } from '../plugin/src/application.ts';
import { MockHost } from './mockHost.ts';
const host=new MockHost();host.reset();
let application:Awaited<ReturnType<typeof startApplication>>|undefined;
const panel=document.createElement('details');panel.open=true;panel.id='mock-host-controls';
Object.assign(panel.style,{position:'fixed',top:'8px',left:'50%',transform:'translateX(-50%)',width:'310px',maxHeight:'75vh',overflow:'auto',padding:'12px',background:'#102e3e',color:'#fff',border:'1px solid #84cbd0',borderRadius:'10px',zIndex:'20000',font:'12px system-ui'});
const summary=document.createElement('summary');summary.textContent='Mock Locus Host · synthetic data';panel.append(summary);
const explanation=document.createElement('p');explanation.textContent='No real profiles, chats, model calls or permissions. Native intentions are recorded below.';panel.append(explanation);
let pendingAction:Promise<void>=Promise.resolve();
const controls=document.createElement('div');Object.assign(controls.style,{display:'flex',flexWrap:'wrap',gap:'5px'});panel.append(controls);
function button(label:string,action:()=>void|Promise<void>){const b=document.createElement('button');b.textContent=label;b.type='button';b.onclick=()=>{pendingAction=pendingAction.then(action).then(update).catch(showUnavailable);};controls.append(b);}
async function reconnect(){await application?.dispose();host.reconnect();application=await startApplication(host,{demo:true,now:()=>host.now,random:host.random});update();}
async function reset(count:number){host.reset(count);await reconnect();}
button('Reset 10',()=>reset(10));button('Zero agents',()=>reset(0));button('100 agents',()=>reset(100));button('500 agents',()=>reset(500));
button('Add agent',()=>host.add());button('Remove agent',()=>host.remove());button('Rename first',()=>host.rename());
button('Start task',()=>host.setStatus('working'));button('Complete task',()=>host.setStatus('completed'));button('Fail task',()=>host.setStatus('failed'));button('Queue task',()=>host.setStatus('queued'));
button('Raise approval',()=>host.approval());button('Resolve approval',()=>host.resolveApproval());button('Transfer',()=>host.transfer());
button('Pause / resume',()=>{host.paused=!host.paused;});button('Step frame (33ms)',()=>host.step());
button('Delay / deliver',()=>{host.delay=!host.delay;if(!host.delay)host.flush();});button('Deliver newest',()=>host.step(true));button('Duplicate event',()=>host.duplicate());button('Drop next event',()=>{host.dropNext=true;});button('Fresh snapshot',()=>host.freshSnapshot());
button('Disconnect',()=>host.revoke());button('Reconnect',reconnect);button('Switch workspace',()=>host.switchWorkspace());
button('Read only',async()=>{host.revoke('Capabilities changed');host.capabilities=['agents.read'];await reconnect();});
button('Full access',async()=>{host.revoke('Capabilities changed');host.capabilities=['agents.read','agents.interact','world.preferences'];await reconnect();});
button('Deny required',async()=>{host.revoke('Capabilities changed');host.capabilities=[];await reconnect();});
button('Reset world settings',async()=>{await application?.client.request('preferences.reset');});
const log=document.createElement('pre');Object.assign(log.style,{whiteSpace:'pre-wrap',maxHeight:'130px',overflow:'auto'});panel.append(log);document.body.append(panel);
function update(){log.textContent=`Fixed clock: ${new Date(host.now).toISOString()}\n${host.state.agents.length} synthetic agents; ${host.paused?'paused':'running'}\nCommands:\n`+host.commands.slice(-8).map(c=>`${c.command} ${JSON.stringify(c.arguments)}`).join('\n');}
const tick=window.setInterval(()=>{if(!host.paused)host.now+=33;},33);
window.addEventListener('pagehide',()=>clearInterval(tick),{once:true});
void reconnect().catch(showUnavailable);
