import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSearchUI} from '../search-ui.mjs';
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const match=(title='A <private> thought')=>({total:1,truncated:false,results:[{id:'record',kind:'day',source:'ledger',title,metadata:'Saved day',snippet:'A useful note'}]});
function harness(){
  const original={document:globalThis.document,window:globalThis.window},nodes=new Map(),events=new Map(),windowEvents=new Map(),pending=[],resolutions=[];let blocked=false,otherDialog=false,activated=0,lastError='';
  const node=id=>{if(!nodes.has(id))nodes.set(id,{id,open:false,disabled:false,value:'',textContent:'',innerHTML:'',checked:false,handlers:new Map(),buttons:[],addEventListener(type,fn){this.handlers.set(type,fn);},showModal(){this.open=true;},close(){this.open=false;this.handlers.get('close')?.();},focus(){this.focused=true;},querySelectorAll(){return this.buttons;},querySelector(){return this.buttons[0]||null;}});return nodes.get(id);};
  globalThis.document={querySelector:s=>s==='dialog[open]'?(otherDialog?{}:null):node(s.slice(1)),addEventListener:(t,f)=>events.set(t,f)};
  globalThis.window={addEventListener:(t,f)=>windowEvents.set(t,f)};
  const ui=createSearchUI({api:(path,method,body,signal)=>new Promise((resolve,reject)=>pending.push({path,method,body,signal,resolve,reject})),resolveResult:(row,signal)=>new Promise((resolve,reject)=>resolutions.push({row,signal,resolve:()=>resolve(()=>activated++),reject})),blocked:()=>blocked,error:m=>lastError=m,esc});
  const fire=(id,type,extra={})=>node(id).handlers.get(type)?.({target:node(id),preventDefault(){},...extra});
  const submit=query=>{node('workspace-query').value=query;return fire('workspace-search-form','submit');};
  const clickResult=()=>fire('workspace-results','click',{target:{closest:()=>({dataset:{workspaceResult:'0'}})}});
  return {ui,node,pending,resolutions,fire,submit,clickResult,events,windowEvents,get activated(){return activated;},get lastError(){return lastError;},set blocked(v){blocked=v;},set otherDialog(v){otherDialog=v;},restore(){node('workspace-search-dialog').close();globalThis.document=original.document;globalThis.window=original.window;}};
}
const tick=()=>new Promise(setImmediate);
test('search ignores late responses after query edits, filter changes and close; all result text is escaped',async()=>{
 const h=harness();try{
  h.ui.open();h.submit('first');assert.equal(h.pending[0].path,'/api/search');assert.equal(h.pending[0].method,'POST');
  h.node('workspace-query').value='second';h.fire('workspace-query','input');assert.equal(h.pending[0].signal.aborted,true);h.pending[0].resolve(match('Stale result'));await tick();assert.equal(h.node('workspace-results').innerHTML,'');
  h.node('workspace-source').value='ledger';h.fire('workspace-source','change');h.pending[1].resolve(match());await tick();assert.match(h.node('workspace-results').innerHTML,/&lt;private&gt;/);assert.equal(h.pending[1].body.scope,'ledger');
  h.submit('third');h.node('workspace-search-dialog').close();h.pending[2].resolve(match('Closed result'));await tick();assert.equal(h.node('workspace-results').innerHTML,'');assert.equal(h.node('workspace-query').value,'');assert.equal(h.pending[2].signal.aborted,true);
 }finally{h.restore();}
});
test('record navigation can be cancelled while loading, ignores late activations and retains search after failure',async()=>{
 const h=harness();try{
  h.ui.open();h.submit('notes');h.pending[0].resolve(match());await tick();const cancelled=h.clickResult();assert.equal(h.node('workspace-query').disabled,true);h.node('workspace-search-dialog').close();h.resolutions[0].resolve();await cancelled;assert.equal(h.activated,0);assert.equal(h.resolutions[0].signal.aborted,true);
  h.ui.open();h.submit('notes');h.pending[1].resolve(match());await tick();const failed=h.clickResult();h.resolutions[1].reject(Error('Record was removed.'));await failed;assert.equal(h.node('workspace-search-dialog').open,true);assert.match(h.node('workspace-search-error').textContent,/Record was removed/);assert.equal(h.node('workspace-query').disabled,false);
  h.submit('notes');h.pending[2].resolve(match());await tick();const opened=h.clickResult();h.resolutions[2].resolve();await opened;assert.equal(h.activated,1);assert.equal(h.node('workspace-search-dialog').open,false);
 }finally{h.restore();}
});
test('search respects draft and modal guards, supports keyboard entry and leaves no query after navigation',async()=>{
 const h=harness();try{
  h.blocked=true;h.ui.open();assert.equal(h.node('workspace-search-dialog').open,false);assert.match(h.lastError,/editor/);h.blocked=false;h.otherDialog=true;h.ui.open();assert.equal(h.node('workspace-search-dialog').open,false);h.otherDialog=false;
  h.events.get('keydown')({key:'k',ctrlKey:true,preventDefault(){}});assert.equal(h.node('workspace-search-dialog').open,true);
  const first={focus(){this.focused=true;}},second={focus(){this.focused=true;}};h.node('workspace-results').buttons=[first,second];h.fire('workspace-query','keydown',{key:'ArrowDown'});assert.equal(first.focused,true);h.fire('workspace-results','keydown',{key:'ArrowDown',target:first});assert.equal(second.focused,true);
  h.node('workspace-query').value='private phrase';h.windowEvents.get('hashchange')();assert.equal(h.node('workspace-query').value,'');
 }finally{h.restore();}
});
