import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCommunicationUI} from '../communication-ui.mjs';
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function harness(api){
  const original=globalThis.document,nodes=new Map(),events=new Map(),downloads=[],data={communication:{reps:[],revision:7}};let loads=0,ui;
  function node(id){if(!nodes.has(id))nodes.set(id,{id,open:false,disabled:false,value:'',textContent:'',innerHTML:'',checked:false,handlers:new Map(),addEventListener(type,fn){this.handlers.set(type,fn);},showModal(){this.open=true;},close(){this.open=false;this.handlers.get('close')?.();},focus(){}});return nodes.get(id);}
  globalThis.document={querySelector:s=>node(s.slice(1)),addEventListener(type,fn){if(!events.has(type))events.set(type,[]);events.get(type).push(fn);}};
  const form=node('communication-form');form.elements=Object.fromEntries(['day','topic','drill','skill','note'].map(k=>[k,node(k)]));form.querySelectorAll=()=>[...Object.values(form.elements),node('save')];
  ui=createCommunicationUI({api,getData:()=>data,getWeek:()=>'2026-09-07',load:async()=>{loads++;},render(){},error(){},toast(){},esc,downloadJSON:v=>downloads.push(v),blocked:()=>ui.dirty||ui.saving});
  const target=(key,value='')=>({dataset:{[key]:value},hasAttribute:n=>n==='data-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),closest(){return this;}});
  return {ui,data,node,form,downloads,get loads(){return loads;},restore(){globalThis.document=original;},async click(key,value){for(const f of events.get('click'))await f({target:target(key,value)});},fire(id,type,extra={}){const n=node(id);return n.handlers.get(type)?.({target:n,currentTarget:n,preventDefault(){},...extra});}};
}
test('a rejected speaking save retains its original revision and editable draft, then permits download and explicit discard',async()=>{
  let request,reject;const h=harness((path,method,body)=>{request={path,method,body};return new Promise((_,r)=>{reject=r;});});
  try{
    await h.click('communicationNew');h.form.elements.topic.value='Keep my <draft>';h.form.elements.note.value='A useful detail';h.data.communication.revision=8;
    const pending=h.fire('communication-form','submit');assert.equal(request.body.revision,7);assert.equal(h.ui.saving,true);assert.equal(h.form.elements.topic.disabled,true);
    let cancelled=false;h.fire('communication-dialog','cancel',{preventDefault(){cancelled=true;}});assert.equal(cancelled,true);
    reject(Error('Another device saved first.'));await pending;assert.equal(h.ui.dirty,true);assert.equal(h.ui.saving,false);assert.equal(h.form.elements.topic.disabled,false);
    assert.match(h.node('communication-error').textContent,/draft is still here/);assert.equal(h.loads,0);
    await h.click('communicationDownload');assert.equal(h.downloads[0].rep.topic,'Keep my <draft>');assert.equal(h.downloads[0].revision,7);
    await h.click('communicationReload');assert.equal(h.ui.dirty,false);assert.equal(h.loads,1);
  }finally{h.restore();}
});
test('closing a pending speaking import discards its response; a failed application requires fresh review',async()=>{
  const pending=[];const h=harness((path,method,body)=>new Promise((resolve,reject)=>pending.push({path,body,resolve,reject})));
  const pack={app:'atlas-communication-transfer',version:1,exportedAt:null,reps:[]};
  const select=()=>{h.node('communication-file').files=[{size:100,text:async()=>JSON.stringify(pack)}];return h.fire('communication-file','change');};
  const turn=()=>new Promise(resolve=>setImmediate(resolve));
  try{
    await h.click('communicationImport');const first=select();await turn();assert.equal(pending.length,1);h.node('communication-import-dialog').close();
    pending[0].resolve({pack,revision:0,digest:'first',rows:[],added:0,kept:0});await first;assert.equal(h.node('communication-import-preview').innerHTML,'');assert.equal(h.node('communication-import-confirm').disabled,true);
    await h.click('communicationImport');const second=select();await turn();pending[1].resolve({pack,revision:7,digest:'second',rows:[],added:0,kept:0});await second;
    h.node('communication-consent').checked=true;h.fire('communication-consent','change');const saving=h.fire('communication-import-confirm','click');
    assert.equal(h.node('communication-file').disabled,true);assert.equal(pending[2].body.revision,7);pending[2].reject(Error('Connection interrupted.'));await saving;
    assert.equal(h.ui.dirty,true);assert.equal(h.node('communication-file').disabled,false);assert.equal(h.loads,0);assert.match(h.node('communication-import-error').textContent,/Choose the file again/);
    h.fire('communication-consent','change');assert.equal(h.node('communication-import-confirm').disabled,true);
  }finally{h.restore();}
});
