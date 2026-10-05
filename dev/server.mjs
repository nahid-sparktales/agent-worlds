import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const result=spawnSync(process.execPath,['scripts/build.mjs'],{cwd:root,stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp','.gz':'application/octet-stream'};
const server=createServer(async(req,res)=>{
  try{
    const raw=(req.url??'/').split('?')[0];
    if(req.method!=='GET'||/[\\%]/.test(raw)||raw.split('/').some(s=>s==='..')){res.writeHead(403).end();return;}
    const dev=raw==='/mock-host.js';
    const relative=raw==='/'?'index.html':raw.slice(1);
    const base=path.join(root,dev?'dist/dev':'dist/plugin/ui');
    const filename=path.join(base,dev?'main.js':relative);
    if(!filename.startsWith(base+'/')||!(await stat(filename)).isFile()){res.writeHead(404).end();return;}
    let data=await readFile(filename);
    if(relative==='index.html')data=Buffer.from(data.toString().replace('./static/world.js','/mock-host.js'));
    res.writeHead(200,{'Content-Type':mime[path.extname(filename)]??'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  }catch{res.writeHead(404).end();}
});
const port=Number(process.env.AGENT_WORLDS_DEV_PORT??4173);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid AGENT_WORLDS_DEV_PORT');
server.listen(port,'127.0.0.1',()=>console.log(`Explicit Mock Locus Host: http://127.0.0.1:${port} (synthetic data only)`));
