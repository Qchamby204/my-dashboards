import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reflectionNotes, appendReflections, createReflectionUI } from '../reflection-ui.mjs';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as model from '../model.mjs';

const week = '2026-09-07';
const ledger = { days: [
  {date:'2026-09-06',note:'Previous week',tomorrow:''},
  {date:week,note:'Reading together helped.',tomorrow:'Make room for a quiet start.',checked:['read']},
  {date:'2026-09-13',note:'Sunday reflection',tomorrow:'   '},
  {date:'2026-09-14',note:'Next week',tomorrow:''}
] };
test('reflection selection uses only this week’s nonempty notes; composition preserves both originals and rejects overflow atomically',()=>{
  const original=structuredClone(ledger),rows=reflectionNotes(ledger,week);
  assert.equal(rows.length,3);assert.equal(rows.at(-1).date,'2026-09-13');assert.ok(!('checked' in rows[0]));
  const current={worked:'Keep my earlier review.',change:'Keep this adjustment.'};
  const excerpts=[{...rows[0],destination:'worked',text:'Reading together.'},{...rows[1],destination:'change'}];
  const next=appendReflections(current,excerpts);
  assert.match(next.worked,/^Keep my earlier review\./);assert.match(next.worked,/2026-09-07/);
  assert.ok(next.change.includes('Keep this adjustment.'));assert.deepEqual(appendReflections(next,excerpts),next);
  assert.throws(()=>appendReflections(current,[excerpts[0],{...excerpts[1],text:'x'.repeat(4000)}]),/4,000/);
  assert.equal(current.worked,'Keep my earlier review.');assert.deepEqual(ledger,original);
});

async function harness(run) {
  const original=globalThis.document, nodes=new Map(), listeners=new Map();
  const node=selector=>{
    const key=selector.replace(/^#/,'');
    if(!nodes.has(key)) nodes.set(key,{id:key,value:'',textContent:'',innerHTML:'',disabled:false,checked:false,open:false,dataset:{},handlers:new Map(),addEventListener(type,fn){this.handlers.set(type,fn);},showModal(){this.open=true;},close(){this.open=false;this.handlers.get('close')?.();},focus(){},closest(){return null;}});
    return nodes.get(key);
  };
  globalThis.document={querySelector:node,querySelectorAll:()=>[],addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);}};
  const form=node('review-form'),worked=node('worked'),change=node('change'),button=node('save');
  worked.name='worked';change.name='change';worked.closest=change.closest=()=>form;
  form.elements={worked,change};form.querySelectorAll=()=>[worked,change,button];
  const data={week:{week_start:week,worked:'Earlier review',change:'Earlier adjustment',capacity:180,revision:7},ledger:structuredClone(ledger)};
  let downloads=[],requests=[],captures=[],loads=0,lastError='',rejectSave,resolveSave;
  const fire=async(type,target)=>{for(const fn of listeners.get(type)||[])await fn({target,preventDefault(){}});};
  const click=async(id,attrs={})=>{
    const target=node(id);target.dataset=attrs;target.hasAttribute=name=>name in attrs;target.closest=()=>target;
    await fire('click',target);
  };
  const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  let ui;
  ui=createReflectionUI({api:(path,method,body)=>{requests.push({path,method,body});return new Promise((resolve,reject)=>{resolveSave=resolve;rejectSave=reject;});},getData:()=>data,getWeek:()=>week,load:async()=>{loads++;},render:()=>ui.form(),error:m=>{lastError=m;},toast(){},esc,downloadJSON:v=>downloads.push(v),capture:s=>captures.push(s),blocked:()=>false});
  ui.form();worked.value=data.week.worked;change.value=data.week.change;
  try { await run({ui,data,node,form,worked,change,button,fire,click,downloads,requests,captures,get loads(){return loads;},get lastError(){return lastError;},reject:err=>rejectSave(err),resolve:()=>resolveSave({saved:true})}); }
  finally { globalThis.document=original; }
}

test('selected excerpts can be edited or cancelled, only append to the review draft, and never mutate Ledger or send a save',async()=>harness(async h=>{
  const before=structuredClone(h.data.ledger);
  await h.fire('change',{dataset:{reflectionSelect:week+':note'},checked:true});
  assert.equal(h.ui.dirty,true);
  await h.click('reflection-preview-open');assert.equal(h.node('reflection-dialog').open,true);
  h.node('reflection-dialog').close();assert.equal(h.ui.dirty,true);assert.equal(h.requests.length,0);
  await h.click('reflection-preview-open');
  h.node('[data-excerpt="0"]').value='A shorter <excerpt>';
  h.node('[data-destination="0"]').value='change';
  h.node('reflection-apply').handlers.get('click')();
  assert.equal(h.node('reflection-dialog').open,false);assert.equal(h.requests.length,0);
  await h.click('download',{'data-review-download':''});
  assert.equal(h.downloads[0].review.worked,'Earlier review');
  assert.match(h.downloads[0].review.change,/Earlier adjustment[\s\S]+A shorter <excerpt>/);
  assert.match(h.ui.form(),/A shorter &lt;excerpt&gt;/);assert.deepEqual(h.data.ledger,before);
  assert.equal(h.downloads[0].selectedNotes.length,0);
}));

test('review saves freeze inputs, preserve captured revisions and draft on conflict, and reload only after explicit discard',async()=>harness(async h=>{
  h.worked.value='Keep this unsaved text';await h.fire('input',h.worked);
  h.data.week={...h.data.week,worked:'Newer device copy',revision:8};
  assert.match(h.ui.form(),/Keep this unsaved text/);
  const pending=h.fire('submit',h.form);
  assert.equal(h.ui.saving,true);assert.equal(h.worked.disabled,true);assert.equal(h.requests[0].body.revision,7);
  await h.fire('submit',h.form);assert.equal(h.requests.length,1);
  h.reject(Error('Another device saved first.'));await pending;
  assert.equal(h.ui.dirty,true);assert.equal(h.worked.disabled,false);assert.match(h.node('review-error').textContent,/draft is kept/);
  await h.click('download',{'data-review-download':''});assert.equal(h.downloads[0].review.worked,'Keep this unsaved text');
  assert.equal(h.downloads[0].review.revision,7);assert.equal(h.loads,0);
  await h.click('discard',{'data-review-discard':''});assert.equal(h.ui.dirty,false);assert.equal(h.loads,1);assert.match(h.ui.form(),/Newer device copy/);
}));

test('planning from a note prepares an editable next-week capture and requires clearing pending review choices',async()=>harness(async h=>{
  await h.click('plan',{'data-reflection-capture':'',reflectionCapture:week+':tomorrow'});
  assert.equal(h.captures.length,1);assert.equal(h.captures[0].week_start,'2026-09-14');assert.equal(h.captures[0].app_id,'life-ledger');
  assert.equal(h.captures[0].title,'Make room for a quiet start.');assert.equal(h.requests.length,0);
  await h.fire('change',{dataset:{reflectionSelect:week+':note'},checked:true});
  await h.click('plan',{'data-reflection-capture':'',reflectionCapture:week+':tomorrow'});
  assert.equal(h.captures.length,1);assert.match(h.lastError,/clear any selected/);
}));

test('the actual app protects review edits from late refreshes and hides the previous review while changing weeks',async()=>{
  const original=globalThis.document,nodes=new Map(),listeners=new Map(),pending=[];
  function node(selector){
    if(selector==='dialog[open]')return null;
    if(!nodes.has(selector))nodes.set(selector,{id:selector.replace(/^#/,''),value:'',textContent:'',innerHTML:'',open:false,disabled:false,handlers:new Map(),elements:{},addEventListener(type,fn){this.handlers.set(type,fn);},focus(){},close(){this.open=false;},showModal(){this.open=true;},querySelectorAll(){return [];},closest(){return null;}});
    return nodes.get(selector);
  }
  const document={querySelector:node,querySelectorAll:()=>[],visibilityState:'visible',addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);}};
  const form=node('#review-form'),worked={name:'worked',value:'',closest:()=>form},change={name:'change',value:'',closest:()=>form};form.elements={worked,change};
  globalThis.document=document;
  const context=vm.createContext({...model,createReflectionUI,createCommunicationUI:()=>({dirty:false,saving:false,weekly:()=>'',page:()=>''}),createLedgerUI:()=>({dirty:false,saving:false,daily:()=>''}),createEditionRefreshUI:()=>({saving:false}),document,window:{addEventListener(){}},location:{hash:'#review'},Date,structuredClone,console,setInterval(){},setTimeout(){},fetch:(path)=>new Promise(resolve=>pending.push({path,resolve})),localDay:()=>week});
  const source=readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
  const reply=async(index,data)=>{pending[index].resolve({ok:true,json:async()=>structuredClone(data)});await new Promise(setImmediate);};
  const state={tasks:[],projects:[],week:{week_start:week,worked:'Saved first week',change:'',revision:2,capacity:300},ledger:null,practice:null};
  try{
    vm.runInContext(source,context);await reply(0,state);
    assert.match(node('#content').innerHTML,/Saved first week/);
    const refresh=vm.runInContext('load()',context);
    worked.value='Typing while the request is in flight';for(const fn of listeners.get('input'))fn({target:worked});
    await reply(1,{...state,week:{...state.week,worked:'A different device',revision:3}});await refresh;
    assert.equal(vm.runInContext('data.week.revision',context),2);
    assert.equal(vm.runInContext('hasDraft()',context),true);
    assert.match(vm.runInContext('reflectionUI.form()',context),/Typing while the request is in flight/);
    // Explicitly discard before navigation; its reload receives the fresh week.
    const discard={id:'discard',hasAttribute:name=>name==='data-review-discard',closest:selector=>selector.startsWith('[data-review-download]')?discard:null};
    // Find the reflection listener without depending on the app's other handlers.
    const result=Promise.all(listeners.get('click').map(fn=>fn({target:discard})));
    await reply(2,state);await result;
    const next=vm.runInContext("week='2026-09-14'; load()",context);
    assert.match(node('#content').innerHTML,/Loading the selected week/);assert.ok(!node('#content').innerHTML.includes('Saved first week'));
    await reply(3,{...state,week:null});await next;
    assert.ok(!node('#content').innerHTML.includes('Saved first week'));assert.equal(vm.runInContext('loadedWeek',context),'2026-09-14');
  }finally{globalThis.document=original;}
});
