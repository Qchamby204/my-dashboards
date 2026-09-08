import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../../the-herald.html',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]).join('\n');
const extra=readFileSync(new URL('../../shared/herald-enhancements.js',import.meta.url),'utf8');
const item=id=>({id,title:'Story '+id,script:'A second scene',status:'draft',fmt:'long',vert:'General',kw:'',opt:{title:{t:'Publication title',d:false}},metrics:{},pub:{}});
const state=()=>({videos:[item('one'),item('two')],cadence:{},weeks:{},leads:[],capture:[],roadmap:[],sys:{once:{},w:{},m:{}},goals:{}});
function boot(raw=state()){
  const nodes=new Map(),events=new Map(),winEvents=new Map();
  const node=id=>{if(!nodes.has(id)){
    let content='';const n={id,value:'',dataset:{},hidden:false,textContent:'',style:{},classList:{add(){},remove(){}},appendChild(){},before(){},setAttribute(){},remove(){},focus(){},select(){},click(){},get innerHTML(){return content;},set innerHTML(s){content=s;if(id==='view')for(const [key,x]of nodes)if(key.startsWith('nv-')||key.startsWith('pkg-'))x.value='';}};nodes.set(id,n);
  }return nodes.get(id);};
  const storage=new Map([['herald:v1',JSON.stringify(raw)]]),localStorage={blocked:false,getItem:k=>storage.get(k)||null,removeItem:k=>storage.delete(k),setItem(k,v){if(this.blocked)throw Error('Quota');storage.set(k,String(v));}};
  const document={documentElement:{dataset:{atlasApp:'the-herald'}},readyState:'complete',getElementById:node,querySelector:()=>null,querySelectorAll:()=>[],createElement:node,body:node('body'),addEventListener:(k,f)=>events.set(k,f),execCommand:()=>false};
  const window={addEventListener:(k,f)=>winEvents.set(k,f),scrollTo(){}};
  const context=vm.createContext({window,document,localStorage,navigator:{},Date,URL,Blob,setTimeout:()=>1,clearTimeout(){},setInterval(){}});
  vm.runInContext(scripts+'\n'+extra,context);
  const run=s=>vm.runInContext(s,context),input=(id,value,dataset={})=>{node(id).value=value;events.get('input')({target:{id,value,dataset}});};
  return {node,run,input,storage,localStorage,window,api:window.HeraldImprovements};
}
test('the original Herald keeps its vault and packaging workflow while writing drafts survive tab changes and reload',()=>{
  const h=boot();assert.match(h.run('renderVault()'),/Add to vault/);assert.match(h.run('vaultBody(S.videos[0])'),/PACKAGING WITH CLAUDE/);
  h.input('nv-title','Unfinished idea');h.input('pkg-one','===TITLE===\nA package draft');h.run("go('calendar');go('vault')");assert.equal(h.node('nv-title').value,'Unfinished idea');assert.equal(h.node('pkg-one').value,'===TITLE===\nA package draft');
  assert.equal(h.api.persist(),true);const again=boot(JSON.parse(h.storage.get('herald:v1')));assert.equal(again.node('nv-title').value,'Unfinished idea');
});
test('script input persists without a blur, and quota failures cannot report a successful save',()=>{
  const h=boot();h.input('script','New writing',{heraldScript:'one'});assert.equal(h.api.pending,true);assert.equal(h.api.persist(),true);assert.equal(JSON.parse(h.storage.get('herald:v1')).videos[0].script,'New writing');
  h.localStorage.blocked=true;h.input('script','Unstored writing',{heraldScript:'one'});assert.equal(h.api.persist(),false);h.run("toast('Script saved')");assert.match(h.node('toast').textContent,/Not saved/);assert.equal(h.node('herald-save-error').hidden,false);assert.equal(h.api.pending,true);
  h.localStorage.blocked=false;assert.equal(h.api.persist(),true);assert.equal(JSON.parse(h.storage.get('herald:v1')).videos[0].script,'Unstored writing');
});
test('search and select all shown agree, and title edits preserve scripts and checklists',()=>{
  const h=boot();h.input('herald-search','Story two');h.run('selectAllShown()');assert.equal(h.run('selIds.size'),1);assert.equal(h.run("selIds.has('two')"),true);
  assert.equal(h.api.rename('one','A changed title'),true);assert.equal(h.run('S.videos[0].script'),'A second scene');assert.equal(h.run('S.videos[0].opt.title.t'),'Publication title');assert.equal(h.api.rename('one','  '),false);
});
test('delete and bulk delete Undo preserve unrelated later writing',()=>{
  const h=boot();h.run("delScript('one');S.videos[0].script='Later writing'");h.node('button').onclick();assert.equal(h.run("vById('two').script"),'Later writing');
  h.run("selIds.add('one');delSel();delSel();S.videos[0].script='Even later'");h.node('button').onclick();assert.equal(h.run("vById('two').script"),'Even later');assert.equal(h.run('S.videos.length'),2);
});
test('applied packaging clears its saved draft and failed clipboard fallback does not claim success',()=>{
  const h=boot();h.input('pkg-one','===TITLE===\nFresh title');h.api.persist();h.run("applyPkg('one')");assert.equal(h.run('S.videos[0].opt.title.t'),'Fresh title');assert.equal(h.run("S._writingDrafts['pkg-one']"),undefined);
  h.run("fallbackCopyText('Example','Copied successfully')");assert.match(h.node('toast').textContent,/Copy unavailable/);
});
