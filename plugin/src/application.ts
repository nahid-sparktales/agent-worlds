import { HostClient } from '../../packages/core/src/client.ts';
import type { Transport } from '../../packages/core/src/client.ts';
import { WorldRuntime } from '../../packages/core/src/runtime.ts';
import type { JSONValue, HostSnapshot, Response } from '../../packages/sdk/src/protocol.ts';
import { createLocalLineWorld } from '../../packages/local-line/src/localLineWorld.ts';
export function assetURL(relative: string): string {
  if (!relative || relative.length > 1024 || /[%\\:?#\u0000-\u001f]/.test(relative) || relative.startsWith('/') || relative.split('/').some(part=>!part || part==='.' || part==='..')) throw new Error('Asset path is outside the installed world');
  return new URL(relative, new URL('.',window.location.href)).href;
}
function connectionOverlay(): { show(message: string): void; hide(): void; dispose(): void } {
  const panel=document.createElement('div');panel.id='host-connection';panel.setAttribute('role','alert');
  Object.assign(panel.style,{position:'fixed',inset:'0',zIndex:'10000',background:'#0b2134',color:'#f6f0dd',display:'grid',placeContent:'center',gap:'20px',padding:'32px',textAlign:'center',fontFamily:'system-ui'});
  const label=document.createElement('p');const button=document.createElement('button');button.type='button';button.textContent='Retry connection';button.onclick=()=>location.reload();panel.append(label,button);document.body.append(panel);
  return{show(message){label.textContent=message;panel.hidden=false;panel.style.display='grid';},hide(){panel.hidden=true;panel.style.display='none';},dispose(){panel.remove();}};
}
export async function startApplication(transport: Transport, options: { demo?: boolean; now?:()=>number; random?:()=>number } = {}): Promise<{dispose():Promise<void>; client:HostClient}> {
  const overlay=connectionOverlay();overlay.show('Connecting to Locus…');
  const runtime=new WorldRuntime();let latest:HostSnapshot|undefined;let visible=true;let disposed=false;
  const world=createLocalLineWorld({demo:options.demo===true});
  const client=new HostClient(transport,{
    required:[...world.capabilities.required],optional:[...world.capabilities.optional],id:()=>crypto.randomUUID(),
    status(status,reason){if(status!=='connected')overlay.show(reason??'Connecting to Locus…');},
    snapshot(snapshot){latest=snapshot;runtime.snapshot(snapshot);overlay.hide();void runtime.setActive(visible&&!document.hidden).catch(failed);},
    event(event){latest={version:2,type:'snapshot',sessionID:event.sessionID,scopeID:event.scopeID,streamID:event.streamID,sequence:event.sequence,state:event.event.state};runtime.event(event);overlay.hide();void runtime.setActive(visible&&!document.hidden).catch(failed);},
    visibility(value){visible=value;void runtime.setActive(value&&!document.hidden).catch(failed);},
    invalidated(){
      overlay.show('Connection unavailable. Reconnect to refresh your agents.');
      if(latest)runtime.snapshot({...latest,state:{agents:[],projectName:'',preferences:{},attentionRequests:[],transfers:[],canCreateAgent:false,nativeChrome:true,focusRequest:0,activityCenterRequest:0}});
      latest=undefined;void runtime.setActive(false).catch(failed);
    },
  });
  const ensureOK=(response:Response)=>{if(!response.ok)throw new Error(response.error.message);};
  function failed(error:unknown){overlay.show(error instanceof Error?error.message:'The world is unavailable.');client.dispose();void runtime.dispose();}
  const visibility=()=>{void runtime.setActive(visible&&!document.hidden).catch(failed);};
  const dispose=async()=>{if(disposed)return;disposed=true;document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',pagehide);client.dispose();await runtime.dispose();overlay.dispose();};
  const pagehide=()=>{void dispose();};
  try{
    await runtime.load(world,{
      bridge:{get capabilities(){return client.capabilities;},request:(command,args)=>client.request(command,args)},
      storage:{get:(key)=>latest?.state.preferences[key],async set(key:string,value:JSONValue){ensureOK(await client.request('preferences.set',{key,value}));},async reset(){ensureOK(await client.request('preferences.reset'));}},
      assets:{resolve:assetURL},log:(level,message)=>console[level==='info'?'info':level](message.slice(0,256)),
      clock:{now:options.now??Date.now,random:options.random??Math.random},
    });
    document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',pagehide,{once:true});
    client.start();
  }catch(error){failed(error);}
  return{dispose,client};
}
export function showUnavailable(error:unknown): void { connectionOverlay().show(error instanceof Error?error.message:'The world is unavailable.'); }
