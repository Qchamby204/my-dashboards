import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {runtimeAssets} from '../asset-versions.mjs';
const root=new URL('../../',import.meta.url),source=readFileSync(new URL('shared/atlas-theme.js',root),'utf8');
function boot(app,manifest,privateProspecting=false){
  const nodes=[],reads=[],writes=[];
  const document={documentElement:{classList:{contains:()=>true},dataset:{atlasApp:app}},readyState:'loading',head:{appendChild:n=>nodes.push(n)},currentScript:{src:'https://example.test/shared/atlas-theme.js?v=012345abcdef'},getElementById:()=>manifest===undefined?null:{textContent:manifest},createElement:tag=>({tag}),querySelectorAll:()=>[],addEventListener(){}};
  const window={AtlasProspectingPrivate:privateProspecting,matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){},dispatchEvent(){}};
  vm.runInNewContext(source,{document,window,localStorage:{getItem:key=>{reads.push(key);return null;},setItem:(...args)=>writes.push(args)},location:{href:'https://example.test/page.html'},URL,history:{},CustomEvent:class{},getComputedStyle:()=>({getPropertyValue:()=>''})});
  for(const node of [...nodes])node.onload?.();
  return {nodes,reads,writes,window};
}
test('every generated runtime manifest matches its shared files and appears before the loader',()=>{
  for(const path of [...readdirSync(root).filter(name=>name.endsWith('.html')),'atlas/index.html','atlas/life-map-legacy.html']){
    const html=readFileSync(new URL(path,root),'utf8'),match=html.match(/id="atlas-runtime-assets">([^<]+)</);
    if(!match)continue;
    const app=html.match(/data-atlas-app=["']([^"']+)/)[1],manifest=JSON.parse(match[1]);
    assert.deepEqual(Object.keys(manifest),runtimeAssets(app),path+' carries only its app dependencies');
    for(const [name,version]of Object.entries(manifest))assert.equal(version,createHash('sha256').update(readFileSync(new URL('shared/'+name,root))).digest('hex').slice(0,12),path+' '+name);
    const entry=html.search(/src="\/?shared\/(?:atlas|communicator)-theme\.js|src="\/theme\.js/);
    assert(match.index<entry,path+' metadata must be available before the synchronous loader');
  }
});
for(const app of ['life-ledger','workout-forge','baby-brain','operations-cadence','prospecting-command-center','neural-map','the-herald','communication-trainer','the-hourglass','life-map','atlas-hub']){
  test(app+' resolves its runtime assets without changing records',()=>{
    const manifest=Object.fromEntries(runtimeAssets(app).map(name=>[name,'abcdef012345'])),result=boot(app,JSON.stringify(manifest));
    const paths=result.nodes.map(n=>new URL(n.src||n.href).pathname.split('/').pop());
    assert.deepEqual(paths.sort(),runtimeAssets(app).sort());
    for(const n of result.nodes)assert.equal(new URL(n.src||n.href).searchParams.get('v'),'abcdef012345');
    assert.deepEqual(result.writes,[]);
    if(app==='life-ledger'){assert(result.window.AtlasLedgerBoot);assert(result.reads.includes('lifeledger:v2'));}
    if(app==='workout-forge'){assert(result.window.AtlasForgeBoot);assert(result.reads.includes('forge:pending-log:v1'));}
  });
}
test('cached pages and malformed metadata fall back to the stable loader URL version',()=>{
  for(const manifest of [undefined,'{bad','null','{"atlas-mobile.js":"https://external.test/evil.js"}']){
    const result=boot('life-map',manifest);
    assert.equal(result.nodes[0].src,'https://example.test/shared/atlas-mobile.js?v=012345abcdef');
  }
});
test('private Prospecting never loads the public record bootstrap',()=>{
  const result=boot('prospecting-command-center','{}',true);
  assert(!result.nodes.some(n=>/prospecting-(?:records|enhancements)/.test(n.src||'')));
  assert(!result.reads.includes('hq_v1'));assert.deepEqual(result.writes,[]);
});
