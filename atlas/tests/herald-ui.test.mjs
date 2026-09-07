import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHeraldUI} from '../herald-ui.mjs';
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function harness(api){
  const original=globalThis.document,nodes=new Map(),events=new Map(),downloads=[],data={herald:{items:[],revision:7}};let loads=0,ui;
  function node(id){if(!nodes.has(id))nodes.set(id,{id,open:false,disabled:false,value:'',textContent:'',innerHTML:'',checked:false,handlers:new Map(),addEventListener(type,fn){this.handlers.set(type,fn);},showModal(){this.open=true;},close(){this.open=false;this.handlers.get('close')?.();},focus(){}});return nodes.get(id);}
  globalThis.document={querySelector:s=>node(s.slice(1)),addEventListener(type,fn){if(!events.has(type))events.set(type,[]);events.get(type).push(fn);}};
  const form=node('herald-form');form.elements=Object.fromEntries(['title','format','audience','stage','scheduled_day','published_day','note'].map(k=>[k,node(k)]));form.querySelectorAll=()=>[...Object.values(form.elements),node('save')];
  ui=createHeraldUI({api,getData:()=>data,getWeek:()=>'2026-09-07',load:async()=>{loads++;},render(){},error(){},toast(){},esc,downloadJSON:v=>downloads.push(v),blocked:()=>ui.dirty||ui.saving});
  const target=(key,value='')=>({dataset:{[key]:value},hasAttribute:n=>n==='data-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),closest(){return this;}});
  return {ui,data,node,form,downloads,get loads(){return loads;},restore(){globalThis.document=original;},async click(key,value){for(const f of events.get('click'))await f({target:target(key,value)});},fire(id,type,extra={}){const n=node(id);return n.handlers.get(type)?.({target:n,currentTarget:n,preventDefault(){},...extra});}};
}
test('a rejected content save retains its original revision and editable draft, then permits download and explicit discard',async()=>{
  let request,reject;const h=harness((path,method,body)=>{request={path,method,body};return new Promise((_,r)=>{reject=r;});});
  try{
    await h.click('heraldNew');h.form.elements.title.value='Keep my <draft>';h.form.elements.note.value='A useful detail';h.data.herald.revision=8;assert.equal(h.form.elements.published_day.disabled,true);h.form.elements.stage.value='published';h.fire('stage','change');assert.equal(h.form.elements.published_day.disabled,false);h.form.elements.published_day.value='2026-09-07';
    const pending=h.fire('herald-form','submit');assert.equal(request.body.revision,7);assert.equal(h.ui.saving,true);assert.equal(h.form.elements.title.disabled,true);assert.equal(h.form.elements.stage.disabled,true);assert.equal(h.form.elements.format.disabled,true);assert.equal(request.body.item.published_day,'2026-09-07');
    let cancelled=false;h.fire('herald-dialog','cancel',{preventDefault(){cancelled=true;}});assert.equal(cancelled,true);
    reject(Error('Another device saved first.'));await pending;assert.equal(h.ui.dirty,true);assert.equal(h.ui.saving,false);assert.equal(h.form.elements.title.disabled,false);
    assert.match(h.node('herald-error').textContent,/draft is still here/);assert.equal(h.loads,0);
    h.form.elements.stage.value='draft';h.fire('stage','change');assert.equal(h.form.elements.published_day.disabled,true);await h.click('heraldDownload');assert.equal(h.downloads[0].item.published_day,null);assert.equal(h.downloads[0].item.title,'Keep my <draft>');assert.equal(h.downloads[0].revision,7);
    await h.click('heraldReload');assert.equal(h.ui.dirty,false);assert.equal(h.loads,1);
  }finally{h.restore();}
});
test('closing a pending content import discards its response; a failed application requires fresh review',async()=>{
  const pending=[];const h=harness((path,method,body)=>new Promise((resolve,reject)=>pending.push({path,body,resolve,reject})));
  const pack={app:'atlas-herald-transfer',version:1,exportedAt:null,items:[]};
  const select=()=>{h.node('herald-file').files=[{size:100,text:async()=>JSON.stringify(pack)}];return h.fire('herald-file','change');};
  const turn=()=>new Promise(resolve=>setImmediate(resolve));
  try{
    await h.click('heraldImport');const first=select();await turn();assert.equal(pending.length,1);h.node('herald-import-dialog').close();
    pending[0].resolve({pack,revision:0,digest:'first',rows:[],added:0,kept:0});await first;assert.equal(h.node('herald-import-preview').innerHTML,'');assert.equal(h.node('herald-import-confirm').disabled,true);
    await h.click('heraldImport');const second=select();await turn();pending[1].resolve({pack,revision:7,digest:'second',rows:[],added:0,kept:0});await second;
    h.node('herald-consent').checked=true;h.fire('herald-consent','change');const saving=h.fire('herald-import-confirm','click');
    assert.equal(h.node('herald-file').disabled,true);assert.equal(pending[2].body.revision,7);pending[2].reject(Error('Connection interrupted.'));await saving;
    assert.equal(h.ui.dirty,true);assert.equal(h.node('herald-file').disabled,false);assert.equal(h.loads,0);assert.match(h.node('herald-import-error').textContent,/Choose the file again/);
    h.fire('herald-consent','change');assert.equal(h.node('herald-import-confirm').disabled,true);
  }finally{h.restore();}
});
