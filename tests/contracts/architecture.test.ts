import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { safeAssetPath,validateWorldMetadata } from '../../packages/sdk/src/world.ts';
const root=fileURLToPath(new URL('../..',import.meta.url));
function files(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):e.name.endsWith('.ts')?[path.join(dir,e.name)]:[]);}
test('Core and SDK cannot import worlds/renderers/browser-native host internals',()=>{
  for(const file of [...files(path.join(root,'packages/sdk/src')),...files(path.join(root,'packages/core/src'))]){
    const source=readFileSync(file,'utf8');const imports=[...source.matchAll(/(?:from\s*|import\s*\()(['"])(.*?)\1/g)].map(m=>m[2]);
    for(const dependency of imports){assert.ok(dependency.startsWith('.'),`${file}: unapproved external dependency ${dependency}`);const resolved=path.resolve(path.dirname(file),dependency);assert.ok(resolved.startsWith(path.join(root,'packages/sdk/'))||resolved.startsWith(path.join(root,'packages/core/')),`${file}: prohibited dependency ${dependency}`);}
    assert.doesNotMatch(source,/['"](?:grand-line|outpost|ship_[a-z_]+)['"]/i);
    if(file.includes('/sdk/'))assert.doesNotMatch(source,/\b(?:window|document|HTMLElement|AppModel|webkit)\b/);
  }
});
test('metadata and confined assets reject incompatible worlds and path escapes',()=>{
  const metadata={id:'dots',name:'Dots',version:'1.0.0',description:'A test',icon:'icon.svg',entrypoint:'main.js',minimumAgentWorldsVersion:'0.2.0',sdkVersion:1 as const,assets:['data/config.json']};
  assert.equal(validateWorldMetadata(metadata,'0.2.0'),true);assert.equal(validateWorldMetadata({...metadata,minimumAgentWorldsVersion:'0.3.0'},'0.2.0'),false);
  for(const path of ['/absolute','../escape','a/../b','a//b','https://example.com','a%2fb','a\\b'])assert.equal(safeAssetPath(path),false,path);
  assert.equal(validateWorldMetadata({...metadata,assets:['../escape']},'0.2.0'),false);
});
