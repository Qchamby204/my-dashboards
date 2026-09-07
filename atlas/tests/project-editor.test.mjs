import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as model from '../model.mjs';

const week='2026-09-07';
function harness(){
  const nodes=new Map(),pending=[],documentEvents=new Map(),windowEvents=new Map();
  function node(selector){
    if(selector==='dialog[open]')return [...nodes.values()].find(n=>n.open)||null;
    if(!nodes.has(selector))nodes.set(selector,{
      id:selector.slice(1),value:'',textContent:'',innerHTML:'',open:false,disabled:false,attributes:{},events:new Map(),
      addEventListener(t,f){this.events.set(t,f);},setAttribute(k,v){this.attributes[k]=v;},focus(){},close(){this.open=false;},showModal(){this.open=true;},
      querySelectorAll(){return [];},reset(){for(const field of Object.values(this.elements))field.value='';},elements:{},
      closest(s){return s.split(',').includes('#'+this.id)?this:null;}
    });
    return nodes.get(selector);
  }
  const form=node('#project-form');form.elements=Object.fromEntries(['title','area','due_date'].map(k=>[k,node('#project-'+k)]));
  const controls=[...Object.values(form.elements),node('#project-submit'),node('#project-discard'),node('#project-close')];
  form.querySelectorAll=()=>controls;
  const document={querySelector:node,querySelectorAll:()=>[],getElementById:id=>node('#'+id),visibilityState:'visible',addEventListener(t,f){if(!documentEvents.has(t))documentEvents.set(t,[]);documentEvents.get(t).push(f);}};
  const context=vm.createContext({...model,
    createCadenceUI:()=>({dirty:false,saving:false,home:()=>'',page:()=>''}),createBudgetUI:()=>({dirty:false,saving:false,panel:()=>''}),createCommitmentsUI:()=>({page:()=>''}),createAgendaUI:()=>({panel:()=>''}),createSearchUI:()=>({}),createReflectionUI:()=>({dirty:false,saving:false}),createLedgerUI:()=>({dirty:false,saving:false}),createHeraldUI:()=>({dirty:false,saving:false}),createCommunicationUI:()=>({dirty:false,saving:false}),createEditionRefreshUI:()=>({saving:false}),
    document,window:{addEventListener:(t,f)=>windowEvents.set(t,f)},location:{hash:'#projects'},Date,structuredClone,setInterval(){},setTimeout(){},localDay:()=>week,
    FormData:class{constructor(f){this.fields=Object.entries(f.elements).filter(([,e])=>!e.disabled).map(([k,e])=>[k,e.value]);} [Symbol.iterator](){return this.fields[Symbol.iterator]();}},
    fetch:(path,options)=>new Promise((resolve,reject)=>pending.push({path,options,resolve,reject}))
  });
  const run=s=>vm.runInContext(s,context);
  run(readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,''));
  const original={id:'project / %20',title:'Original project',area:'Learning',due_date:null,revision:7,mode:'managed',status:'open',archived_at:null};
  const state={tasks:[],projects:[original],week:null};
  const reply=async(i,data=state,status=200)=>{pending[i].resolve({ok:status<400,json:async()=>structuredClone(data)});await new Promise(setImmediate);};
  const submit=()=>form.events.get('submit')({currentTarget:form,preventDefault(){}});
  const input=(name,value)=>{form.elements[name].value=value;form.events.get('input')();};
  const cancel=()=>{const event={prevented:false,preventDefault(){this.prevented=true;}};node('#project-dialog').events.get('cancel')(event);return event;};
  const close=()=>Promise.all((documentEvents.get('click')||[]).map(f=>f({target:{closest:s=>s==='[data-close]'?{dataset:{close:'project-dialog'}}:null},preventDefault(){}})));
  return {run,node,pending,reply,form,controls,original,state,context,windowEvents,submit,input,cancel,close,discard:()=>node('#project-discard').events.get('click')()};
}

test('project editor waits for loaded state, rejects unavailable edit modes and leaves a clean editor dismissible',async()=>{
  const h=harness();h.run('openProjectEditor()');assert.equal(h.node('#project-dialog').open,false);
  await h.reply(0);h.run("openProjectEditor({...data.projects[0],mode:'snapshot'})");assert.equal(h.node('#project-dialog').open,false);
  h.run("openProjectEditor({...data.projects[0],archived_at:'2026-09-07'})");assert.equal(h.node('#project-dialog').open,false);
  h.run('openProjectEditor(data.projects[0])');assert.equal(h.form.elements.title.value,'Original project');assert.equal(h.run('hasDraft()'),false);
  h.cancel();assert.equal(h.node('#project-dialog').open,false);assert.equal(h.pending.length,1);
});

test('project save freezes every control, rejects duplicate saves and closure, and retains the original revision on failure',async()=>{
  const h=harness();await h.reply(0);h.run('openProjectEditor(data.projects[0])');h.input('title','My edited project');
  h.run('data.projects[0].revision=9');const saving=h.submit();
  assert.ok(h.controls.every(c=>c.disabled));assert.equal(h.form.attributes['aria-busy'],'true');
  assert.equal(h.pending[1].path,'/api/projects/'+encodeURIComponent(h.original.id));assert.equal(JSON.parse(h.pending[1].options.body).revision,7);assert.equal(JSON.parse(h.pending[1].options.body).title,'My edited project');
  await h.submit();await h.close();h.cancel();await h.discard();h.run('openProjectEditor()');
  assert.equal(h.pending.length,2);assert.equal(h.node('#project-dialog').open,true);
  await h.reply(1,{error:'Project changed on another device.'},409);await saving;
  assert.equal(h.run('projectDirty'),true);assert.equal(h.run('busy'),false);assert.ok(h.controls.every(c=>!c.disabled));assert.equal(h.form.elements.title.value,'My edited project');assert.match(h.node('#project-error').textContent,/draft is kept/);
  await h.close();h.cancel();assert.equal(h.node('#project-dialog').open,true);assert.match(h.node('#project-error').textContent,/Discard & reload/);
});

test('project drafts block late refreshes, navigation and unload even when only an optional field is edited',async()=>{
  const h=harness();await h.reply(0);const refresh=h.run('load()');h.run('openProjectEditor()');h.input('area','Learning');
  await h.reply(1,{...h.state,projects:[{...h.original,revision:8,title:'Another device'}]});await refresh;
  assert.equal(h.run('data.projects[0].revision'),7);assert.equal(h.form.elements.area.value,'Learning');
  h.context.location.hash='#week';h.windowEvents.get('hashchange')();assert.equal(h.run('view'),'projects');
  const event={prevented:false,preventDefault(){this.prevented=true;}};h.windowEvents.get('beforeunload')(event);assert.equal(event.prevented,true);assert.equal(h.pending.length,2);
});

test('retrying a new project after a lost response reuses its original ID and reports saved state after a failed refresh',async()=>{
  const h=harness();await h.reply(0);h.run('openProjectEditor()');h.input('title','New project');const first=h.submit(),id=JSON.parse(h.pending[1].options.body).id;
  h.pending[1].reject(Error('Lost response'));await first;assert.equal(h.node('#project-dialog').open,true);assert.equal(h.run('projectDirty'),true);
  const second=h.submit();assert.equal(h.pending[2].options.method,'POST');assert.equal(JSON.parse(h.pending[2].options.body).id,id);
  await h.reply(2,{id});assert.equal(h.node('#project-dialog').open,false);assert.equal(h.run('projectDirty'),false);assert.equal(h.run('projectSaving'),true);
  h.pending[3].reject(Error('Refresh unavailable'));await second;
  assert.match(h.node('#toast span').textContent,/Project saved/);assert.match(h.node('#toast span').textContent,/Refresh/);assert.equal(h.run('projectSaving'),false);assert.equal(h.run('hasDraft()'),false);
});

test('discard is explicit, performs no save and reloads fresh project details before another edit',async()=>{
  const h=harness();await h.reply(0);h.run('openProjectEditor(data.projects[0])');h.input('title','Discard this');
  const discard=h.discard();await h.discard();assert.equal(h.node('#project-dialog').open,false);assert.equal(h.run('projectDirty'),false);assert.equal(h.run('projectSaving'),true);
  h.run('openProjectEditor(data.projects[0])');assert.equal(h.node('#project-dialog').open,false);
  await h.reply(1,{...h.state,projects:[{...h.original,title:'Latest saved project',revision:8}]});await discard;
  h.run('openProjectEditor(data.projects[0])');assert.equal(h.form.elements.title.value,'Latest saved project');assert.equal(h.run('editingProject.revision'),8);assert.ok(h.pending.every(p=>p.options.method==='GET'));
});

test('failed discard refresh is labelled and can be retried without a write',async()=>{
  const h=harness();await h.reply(0);h.run('openProjectEditor(data.projects[0])');h.input('due_date','2026-09-18');const discard=h.discard();h.pending[1].reject(Error('Offline'));await discard;
  assert.equal(h.run('projectDirty'),false);assert.equal(h.run('projectSaving'),false);assert.equal(h.node('#save-state').textContent,'Connection needs attention');assert.match(h.node('#toast span').textContent,/Refresh/);
  const refresh=h.run('load()');await h.reply(2,{...h.state,projects:[{...h.original,revision:8,due_date:'2026-09-21'}]});await refresh;
  h.run('openProjectEditor(data.projects[0])');assert.equal(h.form.elements.due_date.value,'2026-09-21');assert.ok(h.pending.every(p=>p.options.method==='GET'));
});
